using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Data;
using System.Text;
using System.Windows.Forms;
using System.Diagnostics;

namespace AlloyTeam.MobileWeb
{
    public partial class DebuggerConsoleView : UserControl
    {
        const string TYPE_COLUMN_NAME = "Type";
        const string URL_COLUMN_NAME = "URL";
        const int TYPE_COLUMN_INDEX = 1;
        const int URL_COLUMN_INDEX = 2;
        const string HTML_TYPE = "Html";
        const string JS_TYPE = "Javascript";

        public DebuggerConsoleController Controller { get; set; }
        List<ListViewItem> checkedItems = new List<ListViewItem>();
        public DebuggerConsoleView()
        {
            InitializeComponent();
            this.urlListView.Columns.Add("", 20);
            this.urlListView.Columns.Add(TYPE_COLUMN_NAME, 80);
            this.urlListView.Columns.Add(URL_COLUMN_NAME, 300);
        }

        public void ShowProjectFiles(DebugProjectModule project)
        {
            this.urlListView.Items.Clear();
            foreach (var html in project.HTMLPageURLs)
            {
                AddUrl(html, HTML_TYPE);
            }
            foreach (var js in project.JSFileURLs)
            {
                AddUrl(js, JS_TYPE);
            }
        }
        void AddUrl(string url, string type)
        {
            ListViewItem item = new ListViewItem();
            item.SubItems.Add(type);
            item.SubItems.Add(url);

            this.urlListView.Items.Add(item);
        }

        private void urlListView_SelectedIndexChanged(object sender, EventArgs e)
        {
            
        }

        private void contextMenuStrip1_Opening(object sender, CancelEventArgs e)
        {
            RefreshCheckedItems();

            if (checkedItems!=null && checkedItems.Count > 0)
            {
                this.deleteToolStripMenuItem.Enabled = true;
            }
            else
            {
                this.deleteToolStripMenuItem.Enabled = false;
            }
        }

        private void RefreshCheckedItems()
        {
            foreach (ListViewItem item in this.urlListView.Items)
            {
                if (item.Checked)
                {
                    checkedItems.Add(item);
                }
            }
        }

        private void deleteToolStripMenuItem_Click(object sender, EventArgs e)
        {
            foreach (ListViewItem item in checkedItems)
            {
                item.Remove();
                switch (item.SubItems[TYPE_COLUMN_INDEX].Text)
                {
                    case HTML_TYPE:
                        this.Controller.RemoveHTMLUrl(item.SubItems[URL_COLUMN_INDEX].Text);
                        break;
                    case JS_TYPE:
                        this.Controller.RemoveJSUrl(item.SubItems[URL_COLUMN_INDEX].Text);
                        break;
                }
            }
            this.checkedItems.Clear();
        }

        internal void Init(DebuggerConsoleController debuggerConsoleController)
        {
            this.Controller = debuggerConsoleController;

        }

        private void txtServerURL_Validated(object sender, EventArgs e)
        {
            string url = this.txtServerURL.Text;
            try
            {
                Uri uri = new Uri(url);
                if (uri.Scheme.ToLower()!="http")
                {
                    this.errorProvider1.SetError(this.txtServerURL, "必须是http协议");
                    return;
                }
                this.errorProvider1.SetError(this.txtServerURL, string.Empty);

                this.Controller.SetServerURL(uri);
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex.Message);
                this.errorProvider1.SetError(this.txtServerURL, "URL格式错误。");
            }
        }
    }
}
