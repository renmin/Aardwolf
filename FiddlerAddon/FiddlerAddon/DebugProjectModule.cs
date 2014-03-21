using System;
using System.Collections.Generic;
using System.Text;

namespace AlloyTeam.MobileWeb
{
    public class DebugProjectModule
    {
        public string Name { get; set; }
        public string Description { get; set; }

        public bool DoesInsertWeinreJS { get; set; }

        public List<string> HTMLPageURLs { get; set; }
        public List<string> JSFileURLs { get; set; }

        public DebugProjectModule()
        {
            this.HTMLPageURLs = new List<string>();
            this.JSFileURLs = new List<string>();
        }

        public string JSFilename { get; set; }
    }
}
