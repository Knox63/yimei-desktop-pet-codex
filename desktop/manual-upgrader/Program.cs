using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        Application.Run(new UpgradeWindow(root));
    }
}

internal sealed class UpgradeWindow : Form
{
    private readonly string root;
    private readonly string run;
    private readonly Label phase = new Label();
    private readonly TextBox details = new TextBox();
    private readonly ProgressBar progress = new ProgressBar();
    private readonly Button logs = new Button();
    private readonly Timer poll = new Timer();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer();
    private Process worker;
    private Task<string> errors;
    private Task<string> output;
    private string lastState;

    internal UpgradeWindow(string managerRoot)
    {
        root = managerRoot;
        run = Path.Combine(root, "manual-updates", DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 8));
        Text = "逸美 · 一键适配 Codex";
        ClientSize = new Size(620, 385);
        AutoScaleMode = AutoScaleMode.Dpi;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        Font = new Font("Microsoft YaHei UI", 10);
        BackColor = Color.FromArgb(248, 249, 251);
        string icon = Path.Combine(root, "icon.ico");
        if (File.Exists(icon)) Icon = new Icon(icon);

        Label title = new Label();
        title.Text = "逸美 · 手动升级";
        title.Font = new Font("Microsoft YaHei UI", 19, FontStyle.Bold);
        title.SetBounds(24, 19, 570, 40);
        Controls.Add(title);
        Label intro = new Label();
        intro.Text = "先更新官方 Codex，再点击本工具。仅适配本机已安装的最新版。\r\n不改官方文件，不启动或关闭 Codex，不开启自动跟随。";
        intro.SetBounds(26, 68, 570, 52);
        intro.ForeColor = Color.FromArgb(80, 88, 102);
        Controls.Add(intro);
        phase.Text = "正在准备…";
        phase.SetBounds(26, 133, 570, 29);
        phase.Font = new Font("Microsoft YaHei UI", 11, FontStyle.Bold);
        phase.ForeColor = Color.FromArgb(34, 87, 160);
        Controls.Add(phase);
        progress.SetBounds(27, 170, 566, 8);
        progress.Style = ProgressBarStyle.Marquee;
        progress.MarqueeAnimationSpeed = 30;
        Controls.Add(progress);
        details.SetBounds(27, 194, 566, 101);
        details.Multiline = true;
        details.ReadOnly = true;
        details.ScrollBars = ScrollBars.Vertical;
        details.BorderStyle = BorderStyle.None;
        details.BackColor = BackColor;
        details.Text = "检查兼容性后制作独立副本，验证 working、16 帧和 16 向。通过才更新固定版本，失败保留旧副本。未来版本结构大改时可能需要先更新适配器。";
        Controls.Add(details);
        logs.Text = "查看日志";
        logs.SetBounds(365, 324, 108, 35);
        logs.Enabled = false;
        logs.Click += delegate
        {
            string file = Path.Combine(run, "upgrade.log");
            if (File.Exists(file)) Process.Start(new ProcessStartInfo("notepad.exe", Quote(file)) { UseShellExecute = true });
        };
        Controls.Add(logs);
        Button close = new Button();
        close.Text = "关闭";
        close.SetBounds(485, 324, 108, 35);
        close.Click += delegate { Close(); };
        Controls.Add(close);
        Label hint = new Label();
        hint.Text = "只在你点击时运行";
        hint.SetBounds(27, 331, 270, 25);
        hint.ForeColor = Color.FromArgb(110, 117, 130);
        Controls.Add(hint);
        poll.Interval = 400;
        poll.Tick += Poll;
        Shown += StartWorker;
        FormClosing += ClosingWindow;
    }

    private static string Quote(string text) { return "\"" + text + "\""; }
    private void StartWorker(object sender, EventArgs e)
    {
        try
        {
            Directory.CreateDirectory(run);
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
            info.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " + Quote(Path.Combine(root, "Manual-Upgrade-Worker.ps1")) + " -RunDirectory " + Quote(run);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardError = true;
            info.RedirectStandardOutput = true;
            worker = new Process();
            worker.StartInfo = info;
            if (!worker.Start()) throw new InvalidOperationException("无法启动手动适配任务");
            errors = worker.StandardError.ReadToEndAsync();
            output = worker.StandardOutput.ReadToEndAsync();
            poll.Start();
        }
        catch (Exception error) { Fail("无法开始适配", error.Message); }
    }
    private void Fail(string title, string text)
    {
        phase.Text = title;
        phase.ForeColor = Color.FromArgb(169, 66, 45);
        details.Text = text;
        progress.Style = ProgressBarStyle.Continuous;
        progress.Value = 0;
    }
    private void Poll(object sender, EventArgs e)
    {
        try
        {
            string file = Path.Combine(run, "status.json");
            if (File.Exists(file))
            {
                Dictionary<string, object> status = json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file, Encoding.UTF8));
                lastState = Convert.ToString(status["state"]);
                string message = Convert.ToString(status["message"]);
                phase.Text = lastState == "success" ? "检查完成" : lastState == "failed" ? "适配未完成，旧版保留" : lastState == "busy" ? "已有适配任务正在运行" : message;
                details.Text = message;
                logs.Enabled = File.Exists(Path.Combine(run, "upgrade.log"));
                if (lastState == "success" || lastState == "failed" || lastState == "busy")
                {
                    progress.Style = ProgressBarStyle.Continuous;
                    progress.Value = lastState == "success" ? 100 : 0;
                    phase.ForeColor = lastState == "success" ? Color.FromArgb(25, 119, 84) : Color.FromArgb(169, 66, 45);
                }
            }
            if (worker != null && worker.HasExited)
            {
                if (lastState == null || lastState == "running")
                    Fail("工具未正常完成，固定版本未自动切换", errors == null ? "请查看日志" : errors.Result);
                poll.Stop();
            }
        }
        catch (Exception error)
        {
            if (worker != null && worker.HasExited) { Fail("请查看日志确认结果", error.Message); poll.Stop(); }
        }
    }
    private void ClosingWindow(object sender, FormClosingEventArgs e)
    {
        if (worker != null && !worker.HasExited)
        {
            DialogResult answer = MessageBox.Show(this, "关闭窗口后，本次手动适配仍会继续完成。不会启动或关闭 Codex。是否关闭窗口？", "逸美 · 手动适配", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
            if (answer != DialogResult.Yes) { e.Cancel = true; return; }
        }
        poll.Stop();
    }
    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        poll.Dispose();
        if (worker != null) worker.Dispose();
        base.OnFormClosed(e);
    }
}
