using System;
using System.Windows.Forms;
using Fiddler;
using Timeline;
using AlloyTeam.MobileWeb.Properties;

[assembly: Fiddler.RequiredVersion("2.3.5.0")]

namespace AlloyTeam.MobileWeb { 
public class DebuggerConsole : IAutoTamper    // Ensure class is public, or Fiddler won't see it!
{
    string sUserAgent = "";
    TabPage oPage;
    DebuggerConsoleController debuggerController;


    public DebuggerConsole()
    {
        /* NOTE: It's possible that Fiddler UI isn't fully loaded yet, so don't add any UI in the constructor.

           But it's also possible that AutoTamper* methods are called before OnLoad (below), so be
           sure any needed data structures are initialized to safe values here in this constructor */

        sUserAgent = "Violin";
        debuggerController = new DebuggerConsoleController();

        
    }

    public void OnLoad()
    {
        oPage = new TabPage("MobileDebugger");
        //TODO: add customize icon.
        oPage.ImageIndex = (int)Fiddler.SessionIcons.Timeline;

        oPage.Controls.Add(debuggerController.View);
        debuggerController.View.Dock = DockStyle.Fill;
        FiddlerApplication.UI.tabsViews.TabPages.Add(oPage);
    }
    public void OnBeforeUnload() { }

    public void AutoTamperRequestBefore(Session oSession)
    {
        //oSession.oRequest["User-Agent"] = sUserAgent;
    }
    public void AutoTamperRequestAfter(Session oSession) { }
    public void AutoTamperResponseBefore(Session oSession) {
        this.debuggerController.DoRewrite(oSession);
    }
    public void AutoTamperResponseAfter(Session oSession) {
        
    }
    public void OnBeforeReturningError(Session oSession) { }
}
}