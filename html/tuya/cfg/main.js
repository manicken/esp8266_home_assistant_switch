window.addEventListener('load', setup);

function getNewDeviceItem() {
  return {id:"",key:"",host:""};
}

var data = [];

function setup() {
  loadConfiguration();

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

function drawTable(){
  var dataTableHtml = '';
  
  for(var i=0;i<data.length;i++) {
    dataTableHtml += '<tr>';
    dataTableHtml += '<td style="text-align:center;">' + (i+1) + '</td>';
    dataTableHtml += '<td><input id="id_' + i + '" class="targetIndexItem" type="text" value="' + data[i].id + '"></td>';
    dataTableHtml += '<td><input id="key_' + i + '" class="targetIndexItem" type="text" value="' + data[i].key + '"></td>';
    dataTableHtml += '<td><input id="host_' + i + '" class="targetIndexItem" type="text" value="' + data[i].host + '"></td>';
    dataTableHtml += '</tr>';
  }

  document.getElementById("dataTableBody").innerHTML = dataTableHtml;
}

function applyNewItemCount()
{
  var newItemCount = parseInt(document.getElementById("itemCount").value);
  if (newItemCount == data.length) return;
  
  if (newItemCount > data.length) {
    var diff = newItemCount - data.length;
    for(var i=0;i<diff;i++)
      data.push(getNewDeviceItem());
  }
  else {
    var diff = data.length - newItemCount;
    data.splice(newItemCount, diff);
  }
  drawTable();
}

function loadConfiguration()
{
  getFile("../cfg.json", function(contents3){
    data = JSON.parse(contents3);
    document.getElementById("itemCount").value = data.length;
    drawTable();
  });
}

function saveConfiguration()
{
  var count = data.length;
  data = [];
  //console.log(data.length);
  for (var i=0;i<count; i++) {
    data.push({
      id:document.getElementById("id_"+i).value,
      key:document.getElementById("key_"+i).value,
      host:document.getElementById("host_"+i).value,
    });
  }
  var dataJSON = JSON.stringify(data,null, 4);
  //console.log(datasJSON);
  postFile("/tuya/cfg.json", datasJSON, "text/json");
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

