using System;
using System.Windows.Forms;
using Fiddler;
using Timeline;
using AlloyTeam.MobileWeb.Properties;
using System.Diagnostics;
using System.Collections.Generic;

[assembly: Fiddler.RequiredVersion("2.3.5.0")]

namespace AlloyTeam.MobileWeb
{
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
            //dropping oSession
            oPage.AllowDrop = true;
            oPage.DragEnter+=oPage_DragEnter;
            oPage.DragDrop+=oPage_DragDrop;
        }
        public void OnBeforeUnload() { }

        public void AutoTamperRequestBefore(Session oSession)
        {
            //oSession.oRequest["User-Agent"] = sUserAgent;
            //Disable Caching
            oSession.oRequest.headers.Remove("If-None-Match");
            oSession.oRequest.headers.Remove("If-Modified-Since");
            oSession.oRequest["Pragma"] = "no-cache";
        }
        public void AutoTamperRequestAfter(Session oSession)
        {
            Console.WriteLine(oSession.oRequest.headers);

        }
        public void AutoTamperResponseBefore(Session oSession)
        {
            this.debuggerController.DoRewrite(oSession);
        }
        public void AutoTamperResponseAfter(Session oSession)
        {

        }
        public void OnBeforeReturningError(Session oSession) { }
        void oPage_DragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("Fiddler.Session[]"))
            {
                e.Effect = DragDropEffects.Copy;
            }
            else
            {
                e.Effect = DragDropEffects.None;
            }
        }

        void oPage_DragDrop(object sender, DragEventArgs e)
        {
            Session[] oSessions = (Session[])e.Data.GetData ("Fiddler.Session[]");
            if ((oSessions == null) || (oSessions.Length < 1))
            {
                Debug.Assert(false, "Unexpected drop type."); return;
            }
            else
            {
                List<string> js = new List<string>();

                foreach (var item in oSessions)
                {
                    if (item.oResponse.MIMEType.ToLower().Contains("javascript"))
                    {
                        js.Add(item.fullUrl);
                        
                    }
                }
                this.debuggerController.AddjsUrlToCurrentProject(js.ToArray());
            }
        }
    }
}