/*
 * WeDeRe(Web Debug Remote) base on Aardwolf.
 * 
 * Aardwold mobile runtime library.
 *
 * Do not enable JS strict mode for this file as it
 * will disable some functionality this library depends on.
 */
window.Aardwolf = new (function() {
	//var serverHost = '__SERVER_HOST__';
	//var serverPort = '__SERVER_PORT__';
	var serverUrl = '__SERVER_URL__';
	var cssUrl = serverUrl + '/ui/inject/style.css';
	var breakpoints = {};
	var shouldBreak = function() { return false; };
	var asyncXHR = null;
	var lastFile = '';
	var lastLine = '';
	
	var listenTimeout = null;

	var consoleRedirected = false;

	var $breakpointTip,$tipText,tipShown=false;

	function listenToServer() {
		try {
			dropCommandConnection();

			asyncXHR = new XMLHttpRequest();
			asyncXHR.open('GET', serverUrl + '/mobile/incoming', true);
			asyncXHR.onreadystatechange = function () {
				if (asyncXHR.readyState == 4) {
					if (asyncXHR.responseText) {
						var cmd = safeJSONParse(asyncXHR.responseText);

						if (cmd && cmd.command == 'eval') {
							doEval(function(aardwolfEval) { return eval(aardwolfEval); }, cmd);
						}
						else {
							processCommand(cmd);
						}
						setTimeout(listenToServer, 0);
					}
				}
			};
			listenTimeout = setTimeout(function() {
				dropCommandConnection();
				listenToServer();
			}, 50 * 1000); // Internal XHR timeout fires at 60 secs, we let an adecuate margin to restart the server.

			asyncXHR.send(null);
		} catch (ex) {
			console.log('Aardwolf encountered an error while waiting for command: ' + ex.toString());
			debugger;
			listenToServer();
		}
	}

	function dropCommandConnection() {
		if (asyncXHR) {
			asyncXHR.abort();
		}
		if (listenTimeout) {
			clearTimeout(listenTimeout);
		}
		asyncXHR = null;
		listenTimeout = null;
	}

	function sendToServer(path, payload) {
		try {
			var req = new XMLHttpRequest();
			req.open('POST', serverUrl + '/mobile' + path, false);
			req.setRequestHeader('Content-Type', 'application/json');
			if (path === '/breakpoint') {
				//在同步模式中，会出差错，默认值本身就是0。
				//req.timeout = 0;
			}
			req.send(JSON.stringify(payload));
			if (!req.responseText) {
				// Timeout, retry
				return sendToServer(path, payload);
			}
			return safeJSONParse(req.responseText);
		} catch (ex) {
			alert('Aardwolf encountered an error while sending data: ' + ex.toString());
			listenToServer();
		}
	}

	function replaceConsole() {
		if (!window.console) {
			window.console = {};
		}

		['info', 'log', 'warn', 'error'].forEach(function(f) {
			var oldFunc = window.console[f];

			window.console[f] = function() {
				var args = Array.prototype.slice.call(arguments);
				/* Write to local console before writing to the potentially slow remote console.
				   Make sure that the original function actually exists, otherwise this will
				   case an error on WindowsPhone where the console object is not available. */
				oldFunc && oldFunc.apply(window.console, args);
				if (consoleRedirected) {
					sendToServer('/console', {
						command: 'print-message',
						type: f.toUpperCase(),
						message: args.toString()
					});
				}
			};
		});
	}

	function processCommand(cmd) {
		switch (cmd.command) {
			case 'update-redirect-console':
				consoleRedirected = cmd.data;
				return true;
			case 'set-breakpoints':
				breakpoints = {};
				cmd.data.forEach(function(bp) {
					var file = bp[0];
					var line = bp[1];
					if (!breakpoints[file]) {
						breakpoints[file] = {};
					}
					breakpoints[file][line] = true;
				});
				return true;

			case 'breakpoint-continue':
				shouldBreak = function() { return false; };
				return false;

			case 'break-on-next':
			case 'breakpoint-step':
			case 'breakpoint-step-in':
				shouldBreak = function() { return true; };
				return false;

			case 'breakpoint-step-out':
				shouldBreak = (function(oldDepth) {
					return function(depth) {
						return depth < oldDepth;
					};
				})(stackDepth);
				return false;

			case 'breakpoint-step-over':
				shouldBreak = (function(oldDepth) {
					return function(depth) {
						return depth <= oldDepth;
					};
				})(stackDepth);
				return false;
		}
	}

	function doEval(evalScopeFunc, cmd) {
		var evalResult;
		try {
			evalResult = evalScopeFunc(cmd.data);
		} catch (ex) {
			evalResult = 'ERROR: ' + ex.toString();
		}
		sendEvalResult(evalResult, cmd.data);
	}
	function sendEvalResult(result, input) {
		try{
			if (result instanceof Object) {
				result = JSON.stringify(result, function(k, v) {
					if (typeof v == "function") {
						return "[function]";
					}
					return v;
				});
			}
		}
		catch(ex)
		{
			//result = ex.message;
            var obj = {};
            for(var prop in result){
                var val = result[prop];                
                obj[prop] = val?val.toString():'null';
            }
			result = JSON.stringify(obj, function(k, v) {
				if (typeof v == "function") {
					return "[function]";
				}
				return v;
			});
        }
		sendToServer('/console', {
			command: 'print-eval-result',
			input: input,
			result: result
		});

	}

	function getStack() {
		var callstack = [];
		var currentFunction = arguments.callee;
		var i = 0;
		while ((i < 10) && currentFunction) {
			var fname = currentFunction.name || '<anonymous>';
			callstack.push(fname);
			currentFunction = currentFunction.caller;
			i++;
		}
		return callstack;
	}

	function safeJSONParse(str) {
		try {
			return JSON.parse(str);
		} catch (ex) {
			return null;
		}
	}

	this.init = function() {
		replaceConsole();
		var cmd = sendToServer('/init', {
			command: 'mobile-connected'
		});
		if (cmd) {
			processCommand(cmd);
		}
		listenToServer();

        window.addEventListener("load", eventWindowLoaded, false);
        function eventWindowLoaded() {

            //var tip = getBreakpointTip();
            //tip.style.display='block';

        }
	};

	this.updatePosition = function(file, line, isDebuggerStatement, evalScopeFunc) {
		/* Webkit's exceptions don't contain any useful file and line data,
		   so we keep track of this manually for exception reporting purposes. */
		lastFile = file;
		lastLine = line;

		while (true) {
			var isBreakpoint = (breakpoints[file] && breakpoints[file][line]) || /* explicit breakpoint? */
							   isDebuggerStatement ||                            /* debugger; statement? */
							   shouldBreak(stackDepth);                          /* step (in|over|out) or break-on-next? */

			if (!isBreakpoint) {
				hideBreakpointTip();
				return;
			}
			showBreakpointTip();
			dropCommandConnection();

			var cmd = sendToServer('/breakpoint', {
				command: 'report-breakpoint',
				file: file,
				line: line,
				stack: getStack().slice(1)
			});
			listenToServer();

			if (!cmd) {
				return;
			}

			if (cmd.command == 'eval') {
				doEval(evalScopeFunc, cmd);
			}
			else {
				var isInternalCommand = processCommand(cmd);
				if (!isInternalCommand) {
					return;
				}
			}
		}
	};

	this.reportException = function(e) {
		sendToServer('/console', {
			command: 'report-exception',
			message: e.toString(),
			file: lastFile,
			line: lastLine,
			stack: getStack().slice(1)
		});
	};

	this.inspect = function(object) {
		if (object) {
			sendEvalResult(object, 'Aaardwolf.inspect(variable)');
		} else {
			sendEvalResult('ERROR: Undefined variable', 'Aaardwolf.inspect');
		}
	};

	var stack = [];
	var stackDepth = 0;

	this.pushStack = function(functionName, file, line) {
		stack.push([functionName, file, line]);
		++stackDepth;
	};

	this.popStack = function() {
		var f = stack.pop();
		--stackDepth;
	};

	function showBreakpointTip(){
        return; //pause之后阻塞了dom 操作
        if(!tipShown){
            tipShown=true;
            var tip = getBreakpointTip();
            tip.style.display='block';
	    }
    }
	function hideBreakpointTip(){
        return; //pause之后阻塞了dom 操作
        if(tipShown){
            tipShown = false;
            var tip = getBreakpointTip();
            tip.style.display='none';	
        }
    }
	function getBreakpointTip(){
		if(!$breakpointTip){
			createBreakpointTip();
		}
        return $breakpointTip;

	}
	function createBreakpointTip(){
        if(document.body){
         
		    //inject css
		    document.head.innerHTML = document.head.innerHTML+'<link href="'+cssUrl+'" rel="stylesheet" type="text/css" />';
		    //create tip dom
		    $breakpointTip = document.createElement('div');
		    $breakpointTip.className = 'wedere-tip';
		    $tipText = document.createElement('div');
		    $tipText.className = 'tip-text';
		    $tipText.innerHTML = 'Paused in Remote Debugger';
		    $breakpointTip.appendChild($tipText);
		
		    document.body.appendChild($breakpointTip);
        }
	}

})();

window.Aardwolf.init();

