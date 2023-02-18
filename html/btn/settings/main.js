window.addEventListener('load', setup);

function setup() {
  getModes(setup2);
}
function setup2() {
  getTargets(loadSettings)
}

function loadSettings()
{
  loadFile("../settings.json");
}

var modes = [];
var targets = [];
 
// TODO replace getModes, getTargets & loadFile with one function
 
function getModes(whenDone) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      modes = JSON.parse(xhttp.responseText);
      console.log(modes);
      whenDone();
    }
  };
  xhttp.open('GET', '../../modes', true);
  xhttp.send();
}

function getTargets(whenDone) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      targets = JSON.parse(xhttp.responseText);
      console.log(targets);
      whenDone();
    }
  };
  xhttp.open('GET', '../../targets', true);
  xhttp.send();
}

function loadFile(path){
  xmlHttp = new XMLHttpRequest();
  xmlHttp.onload = fileLoaded;
  xmlHttp.open("GET", path, true);
  xmlHttp.send(null);
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

function fileLoaded(){

  if (xmlHttp.status == 200) {

    var buttons = JSON.parse(xmlHttp.responseText);
    /*var table = d3.select('table');
    var thead = table.append('thead');
	  var	tbody = table.append('tbody');
    var thr = thead.append('tr');
    thr.append('th').html("Target");
    thr.append('th').html("Target<br>Index");
    thr.append('th').html("Target<br>Mode");
    thr.append('th').html("Button<br>Exec<br>State");
    */
    var buttonsHtml = "";
    buttonsHtml += '<tr><th id="colTarget">Target</th><th id="colTargetIndex">Target<br>Index</th><th id="colTargetMode">Target<br>Mode</th><th id="colButtonExecState">Button<br>Exec<br>State</th></tr>';
    for(var i=0;i<buttons.length;i++) {
      buttonsHtml += '<tr>';
      //buttonsHtml += '<td><input type="text" value="' + buttons[i].target + '"></td>';
      buttonsHtml += '<td><select id="target_' +i + '">'+getTargetOptionsHtml()+'</select></td>';
      buttonsHtml += '<td><input type="text" value="' + buttons[i].ti + '"></td>';
      //buttonsHtml += '<td><input type="text" value="' + buttons[i].tm + '"></td>';
      buttonsHtml += '<td><select id="tm_'+i+'">'+getTargetModeOptionsHtml()+'</select></td>';
      //buttonsHtml += '<td><input type="text" value="' + buttons[i].bes + '"></td>';
      buttonsHtml += '<td><select id="bes_' +i + '">'+getButtonExecStateOptionsHtml()+'</select></td>';

      buttonsHtml += '</tr>';
    }
    //tbody.html(buttonsHtml);
    document.getElementById("buttonsTable").innerHTML = buttonsHtml;
    for(var i=0;i<buttons.length;i++) {
      document.getElementById("target_"+i).value = buttons[i].target;
      document.getElementById("tm_"+i).value = buttons[i].tm;
      document.getElementById("bes_"+i).value = buttons[i].bes;
    }
   
    
  }
}

function getSwitchEntities() {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
         if (this.readyState == 4 && this.status == 200) {
           var json = JSON.parse(this.responseText);
           var switches = [];
           for (var i = 0; i < json.length; i++) {
             if (json[i].entity_id.startsWith("switch"))
                switches.push(json[i].entity_id);
           }
           console.log(switches);
             //alert(this.responseText);
         }
    };
    xhttp.open("GET", "http://192.168.1.180:8123/api/states", true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJiNzVlMzI2NTg0OWE0YTYxOGUwMTM2MjBlMmM0MGVhMiIsImlhdCI6MTY3NjI5OTQxNCwiZXhwIjoxOTkxNjU5NDE0fQ.p3VeuB3M8Gulv-K52X_aDaDfYjxRi8wD3YrNooxAQZ4");
    //xhttp.setRequestHeader("Access-Control-Allow-Origin", "Origin, Accept, X-Requested-With, Content-type, Authorization");
    xhttp.send("");

}

function saveSettings()
{
  var settings = [];
  
  /*for (var i = 0;i<8;i++) {
    settings.items[i] = {id:document.getElementById("item"+i+"id").value, 
                         mode:parseInt(document.getElementById("item"+i+"mode").value)}
  }*/
  
  var settingsJSON = JSON.stringify(settings,null, 4);
  
  //console.log(settingsJSON);
  
  postFile("../settings.json", settingsJSON, "text/json")
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
    xmlHttp.onload = newSettingsLoaded;
    xmlHttp.open("GET", "./load", true);
    xmlHttp.send(null);
  }
}

function newSettingsLoaded()
{
  if (xmlHttp.status != 200) setState("fail to load settings"); //showHttpError(xmlHttp);
  else
    setState("new settings loaded");
    //console.log("new settings loaded");
}

