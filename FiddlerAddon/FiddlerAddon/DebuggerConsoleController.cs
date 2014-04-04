using System;
using System.Collections.Generic;
using System.Text;
using System.Net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Windows.Forms;
using System.Diagnostics;
using Fiddler;
using System.Xml.Serialization;

namespace AlloyTeam.MobileWeb
{
	public class DebuggerConsoleController
	{
		internal JObject Settings { get; set; }

		DebuggerConsoleView view;
		public DebuggerConsoleView View
		{
			get
			{
				if (this.view == null)
				{
					view = new DebuggerConsoleView();
					view.Init(this);
					//view.Controller = this;
				}
				return view;
			}
		}

		public DebugProjectModule CurrentProject { get; set; }
		const string __SERVER_URL__ = "__SERVER_URL__";
		//const string __SERVER_HOST__ = "__SERVER_HOST__";
		//const string __SERVER_URL__ = "__SERVER_PORT__";

		string serverURL,
			htmlRewriteCgi,
			jsRewriteCgi,
			submitListCgi,
			configPath;
		System.Reflection.Assembly thisDll;
		public DebuggerConsoleController()
		{
			LoadConfig();
			RefreshServerCgi();
			this.View.btnAdd.Click += btnAdd_Click;
            this.View.btnSubmit.Click+=btnSubmit_Click;
			this.View.txtServerURL.Text = serverURL;

			this.CurrentProject = new DebugProjectModule();
		}

        private void btnSubmit_Click(object sender, EventArgs e)
        {
            this.SubmitFileList();
        }

		private void RefreshServerCgi()
		{

			serverURL = string.Format("http://{0}:{1}", Settings["serverIP"].Value<string>(), Settings["serverPort"].Value<string>());
			htmlRewriteCgi = string.Format("http://{0}:{1}/fiddler/html", Settings["serverIP"].Value<string>(), Settings["serverPort"].Value<string>());
			jsRewriteCgi = string.Format("http://{0}:{1}/fiddler/js", Settings["serverIP"].Value<string>(), Settings["serverPort"].Value<string>());
			submitListCgi = string.Format("http://{0}:{1}/files/submitlist", Settings["serverIP"].Value<string>(), Settings["serverPort"].Value<string>());

		}

		#region Load & Save Settings
		
		private void LoadConfig()
		{
			thisDll = System.Reflection.Assembly.GetAssembly(typeof(DebuggerConsole));
			string dir = System.IO.Path.GetDirectoryName(this.thisDll.Location);
			this.configPath = System.IO.Path.Combine(dir, "DebuggerConsole\\config.json");
			if (System.IO.File.Exists(configPath))
			{
				string data = System.IO.File.ReadAllText(configPath);
				this.Settings = JsonConvert.DeserializeObject(data) as JObject;
			}
			if (this.Settings == null)
			{
				this.Settings = GetDefaultSetting();
			}
		}
		private void SaveSetting()
		{
			var text = this.Settings.ToString();
			try
			{
				System.IO.File.WriteAllText(this.configPath,text);
			}
			catch (Exception ex)
			{
				MessageBox.Show("配置保存失败：原因：\r\n" + ex.Message);                
			}
		}

		private JObject GetDefaultSetting()
		{
			string config = @"{
	'serverIP':'localhost',
	'serverPort':8000,
	'weinreServer':'',
	'urlWhitelist':[]

}";
			return JsonConvert.DeserializeObject(config) as JObject;
		}

 
		#endregion        
		
		void btnAdd_Click(object sender, EventArgs e)
		{
            this.AddFile(this.View.txtPageUrl.Text);
		}

        void AddFile(string url)
        {
            try
            {
                WebClient wc = new WebClient();
                string content = wc.DownloadString(url);
                string contentType = wc.ResponseHeaders[HttpResponseHeader.ContentType].ToLower();
            
                if (contentType.Contains("html"))
                {
                    JObject json = new JObject();
                    json["url"] = url;
                    json["html"] = content;

                    this.AddHTMLUrlToCurrentProject(new JObject[]{json});
                }
                else if(contentType.Contains("javascript"))
                {
                    this.AddjsUrlToCurrentProject(new string[]{url});
                }
                this.View.ShowProjectFiles(this.CurrentProject);

            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
            }
        }
        public void AddHTMLUrlToCurrentProject(JObject[] dataArr)
        {
            var count = 0;
            foreach (var json in dataArr)
            {
                try
                {
                    var htmlURL = json["url"].Value<string>();
                    string result = this.PostJSONToServer(json, htmlRewriteCgi);
                    JObject jsResult = JsonConvert.DeserializeObject(result) as JObject;
                    if (jsResult["error"] == null)
                    {
                        CurrentProject.HTMLPageURLs.Add(htmlURL);
                        JArray linkScripts = jsResult["linkScripts"] as JArray;
                        if (linkScripts != null)
                        {
                            foreach (var js in linkScripts)
                            {
                                CurrentProject.JSFileURLs.Add(js.Value<string>());
                            }
                        }
                        this.CurrentProject.JSFilename = jsResult["jsFilename"].Value<string>().Replace(__SERVER_URL__, this.serverURL);
                        count++;
                    }
                    else
                    {
                        MessageBox.Show(jsResult["error"].Value<string>());
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[ERROR] in AddHTMLUrlToCurrentProject, Message:" + ex.Message);
                }
            }
            if (count > 0)
            {
                this.View.ShowProjectFiles(this.CurrentProject);
            }

        }

		public void AddHTMLUrlToCurrentProject(string htmlURL)
		{
			JObject json = new JObject();
			json["url"] = htmlURL;
			string result = this.PostJSONToServer(json, htmlRewriteCgi);

			JObject jsResult = JsonConvert.DeserializeObject(result) as JObject;
			if (jsResult["error"] == null)
			{
				CurrentProject.HTMLPageURLs.Add(htmlURL);
				JArray linkScripts = jsResult["linkScripts"] as JArray;
				if (linkScripts != null)
				{
					foreach (var js in linkScripts)
					{
						CurrentProject.JSFileURLs.Add(js.Value<string>());
					}
					SubmitFileList();
				}
				this.CurrentProject.JSFilename = jsResult["jsFilename"].Value<string>().Replace(__SERVER_URL__,this.serverURL);
				this.View.ShowProjectFiles(this.CurrentProject);
			}
			
		}
        public void AddjsUrlToCurrentProject(string[] jsurl)
        {
            var count = 0;
            foreach (var item in jsurl)
            {
                try
                {
                    Uri uri = new Uri(item);
                    string url = uri.AbsoluteUri;
                    if (uri.Query.Length > 0)
                    {
                        url = url.Substring(0, url.IndexOf(uri.Query));
                    }
                    this.CurrentProject.JSFileURLs.Add(url);
                    count++;
                }
                catch (Exception ex)
                {
                    
                    Debug.WriteLine("[ERROR] in AddjsUrlToCurrentProject, Message:"+ ex.Message);
                }

            }
            if (count > 0)
            {
                this.View.ShowProjectFiles(this.CurrentProject);
            }
        }

		public void DoRewrite(Session oSession)
		{
			DebugProjectModule project;
			project = CurrentProject;

			if (project.HTMLPageURLs.Contains(oSession.fullUrl))
			{
				if (oSession.oResponse.headers.ExistsAndContains("Content-Type", "html"))
				{
					Encoding oEnc = Utilities.getResponseBodyEncoding(oSession);
					oSession.utilDecodeResponse();
					var oBody = oEnc.GetString(oSession.responseBodyBytes);

					JObject json = new JObject();
					json["url"] = oSession.fullUrl;
					json["html"] = oBody;
					string result = this.PostJSONToServer(json, htmlRewriteCgi);
					//TODO: parse result to json
					JObject jsResult = JsonConvert.DeserializeObject(result) as JObject;
					if (jsResult["error"] == null)
					{
						string body = jsResult["html"].Value<string>().Replace(__SERVER_URL__, this.serverURL);
						if (body != null)
						{
							oSession.responseBodyBytes = oEnc.GetBytes(body);
							oSession.oResponse.headers["Content-Length"] = oSession.responseBodyBytes.LongLength.ToString();
                            oSession["ui-backcolor"] = "LightBlue";
						}
					}
					return;
				}
			}
			if (project.JSFileURLs.Contains(oSession.fullUrl))
			{
				if (oSession.oResponse.headers.ExistsAndContains("Content-Type", "javascript"))
				{
					Encoding oEnc = Utilities.getResponseBodyEncoding(oSession);
					oSession.utilDecodeResponse();
					var oBody = oEnc.GetString(oSession.responseBodyBytes);

					JObject json = new JObject();
					json["url"] = oSession.fullUrl;
					json["js"] = oBody;
					string result = this.PostJSONToServer(json, jsRewriteCgi);
					JObject jsResult = JsonConvert.DeserializeObject(result) as JObject;
					if (jsResult["error"] == null)
					{
						string js = jsResult["js"].Value<string>();
						if (js != null)
						{
							oSession.responseBodyBytes = oEnc.GetBytes(js);
							oSession.oResponse.headers["Content-Length"] = oSession.responseBodyBytes.LongLength.ToString();
                            oSession["ui-backcolor"] = "LightBlue";
                        }
					}
					return;

				}
			}
			if (project.JSFilename==oSession.fullUrl)
			{
				Encoding oEnc = Utilities.getResponseBodyEncoding(oSession);
				oSession.utilDecodeResponse();
				string oBody = oEnc.GetString(oSession.responseBodyBytes);
				oBody = oBody.Replace(__SERVER_URL__, this.serverURL);
				oSession.responseBodyBytes = oEnc.GetBytes(oBody);
				oSession.oResponse.headers["Content-Length"] = oSession.responseBodyBytes.LongLength.ToString();
                oSession["ui-backcolor"] = "LightBlue";

			}
			
		}
		string PostJSONToServer(JObject json, string url)
		{
			string data = json.ToString();
			string result;
			var httpWebRequest = (HttpWebRequest)WebRequest.Create(url);
			httpWebRequest.ContentType = "text/json";
			httpWebRequest.Method = "POST";

			try
			{
				using (var streamWriter = new StreamWriter(httpWebRequest.GetRequestStream()))
				{
				
					streamWriter.Write(data);
					streamWriter.Flush();
					streamWriter.Close();

					var httpResponse = (HttpWebResponse)httpWebRequest.GetResponse();
					using (var streamReader = new StreamReader(httpResponse.GetResponseStream()))
					{
						result = streamReader.ReadToEnd();
					}
				}
			}
			catch (Exception ex)
			{

				result = "{error:true, message:'"+ex.Message+"'}";
			}
			return result;

		}

		public void RemoveHTMLUrl(string url)
		{
			this.CurrentProject.HTMLPageURLs.Remove(url);
			//SubmitFileList();
		}
		public void RemoveJSUrl(string url)
		{
			this.CurrentProject.JSFileURLs.Remove(url);
			SubmitFileList();
		}
		public void SetServerURL(Uri uri)
		{
			this.Settings["serverIP"] = uri.Host;
			this.Settings["serverPort"] = uri.Port;
			this.RefreshServerCgi();
			this.SaveSetting();
		}

		void SubmitFileList()
		{
			string list = "";
			
			foreach (var item in CurrentProject.JSFileURLs)
			{
				if (list.Length > 0)
					list += " , ";
				list += "'"+item+"'";

			}
			JObject data = JObject.Parse("{fileList:["+list+"]}");
			PostJSONToServer(data, submitListCgi);
		}


		internal void OpenProject(string filename)
		{
            XmlSerializer ser = new XmlSerializer(typeof(DebugProjectModule));
            DebugProjectModule pro = ser.Deserialize(File.OpenRead(filename)) as DebugProjectModule;
            if (pro == null)
            {
                MessageBox.Show("文件读取失败！");
            }
            else
            {
                this.CurrentProject = pro;
                this.View.ShowProjectFiles(this.CurrentProject);
            }
		}

		internal void SaveCurrentProject(string p)
		{			
			XmlSerializer ser = new XmlSerializer(typeof(DebugProjectModule));
			ser.Serialize(File.Create(p), this.CurrentProject);
		}

        internal void CreateProject()
        {
            this.CurrentProject = new DebugProjectModule();
            this.View.ShowProjectFiles(this.CurrentProject);
        }
    }
}