window.addEventListener('load', setup);

var modes = [];
var targets = [];
var data = [];

function setup() {
  getFile("../../modes", function(contents){
    modes = JSON.parse(contents);
    getFile("../../targets", function(contents2){
      targets = JSON.parse(contents2);
      loadConfiguration();
    });
  });
  setupWebSocket();
}

function getFile(path, whenLoaded) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      whenLoaded(xhttp.responseText);
    }
  };
  xhttp.open('GET', path, true);
  xhttp.send();
}

function getTargetModeOptionsHtml()
{
    var html = "";
    for (var i=0;i<modes.length;i++)
    {
      html += '<option value="' + i + '">'+modes[i]+'</option>'
    }
    return html;
}
function getTargetOptionsHtml()
{
  var html = "";
  for (var i=0;i<targets.length;i++)
  {
    html += '<option value="' + i + '">'+targets[i]+'</option>'
  }
  return html;
}

function getButtonExecStateOptionsHtml()
{
  var html = "";
  html += '<option value="0">Released</option>';
  html += '<option value="1">Pressed</option>';
  return html;
}

function drawTable(){
  var dataTableHtml = '<tr><th id="colIndex"></th><th id="colTarget">Target</th><th id="colTargetIndex">Target<br>Index</th><th id="colTargetMode">Target<br>Mode</th><th id="colButtonExecState">Button<br>Exec<br>State</th></tr>';
  
  for(var i=0;i<data.length;i++) {
    dataTableHtml += '<tr>';
    dataTableHtml += '<td style="text-align:center;">' + (i+1) + '</td>';
    dataTableHtml += '<td><select id="target_' + i + '">' + getTargetOptionsHtml() + '</select></td>';
    dataTableHtml += '<td><input id="ti_' + i + '" class="targetIndexItem" type="text" value="' + data[i].ti + '"></td>';
    dataTableHtml += '<td><select id="tm_' + i + '">' + getTargetModeOptionsHtml() + '</select></td>';
    dataTableHtml += '<td><select id="bes_' + i + '">' + getButtonExecStateOptionsHtml() + '</select></td>';
    dataTableHtml += '</tr>';
  }

  document.getElementById("dataTable").innerHTML = dataTableHtml;
  // set values for select types
  for(var i=0;i<data.length;i++) {
    document.getElementById("target_"+i).value = data[i].target;
    document.getElementById("tm_"+i).value = data[i].tm;
    document.getElementById("bes_"+i).value = data[i].bes;
  }
}

function loadConfiguration()
{
  getFile("../cfg.json", function(contents3){
    data = JSON.parse(contents3);
    drawTable();
  });
}

function saveConfiguration()
{
  var count = data.length;
  data = [];
  //console.log(data.length);
  for (var i=0;i<count; i++) {
    settings.push({
      target:parseInt(document.getElementById("target_"+i).value),
      ti:parseInt(document.getElementById("ti_"+i).value),
      tm:parseInt(document.getElementById("tm_"+i).value),
      bes:parseInt(document.getElementById("bes_"+i).value)
    });
  }
  var dataJSON = JSON.stringify(settings,null, 4);
  //console.log(settingsJSON);
  postFile("/btn/cfg.json", dataJSON, "text/json")
}

function setState(msg) {
  document.getElementById("info").innerHTML = msg;
}

function postFile(path, data, type){
  xmlHttp = new XMLHttpRequest();
  xmlHttp.onload = filePosted;
  var formData = new FormData();
  formData.append("data", new Blob([data], { type: type }), path);
  xmlHttp.open("POST", "../../edit");
  xmlHttp.send(formData);
}

function filePosted(){
  if (xmlHttp.status != 200) setState("fail to save file"); //showHttpError(xmlHttp);
  else {
    setState("file saved");
    xmlHttp = new XMLHttpRequest();
    xmlHttp.onload = newConfigurationLoaded;
    xmlHttp.open("GET", "./load", true);
    xmlHttp.send(null);
  }
}

function newConfigurationLoaded()
{
  if (xmlHttp.status != 200) setState("fail to load Configuration"); //showHttpError(xmlHttp);
  else
    setState("new Configuration loaded");
    //console.log("new Configuration loaded");
}
var webSocketConnection;

function setupWebSocket()
{
  console.log(location.hostname);
  webSocketConnection = new WebSocket('ws://' + location.hostname + ':81/', ['arduino']);
  webSocketConnection.onopen = function () {
    webSocketConnection.send('Connect ' + new Date());
  };
  webSocketConnection.onerror = function (error) {
    console.log('WebSocket Error ', error);
  };
  webSocketConnection.onmessage = function (e) {
    console.log('Debug:\n'+ e.data);
  };
  webSocketConnection.onclose = function () {
    console.log('WebSocket connection closed');
  };
}

