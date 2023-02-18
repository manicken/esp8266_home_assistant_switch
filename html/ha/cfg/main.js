window.addEventListener('load', setup);

var switches = [];

var data = [];

function setup() {
  loadConfiguration();
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

function getEntityIdOptionsHtml()
{
  var html = "";
  for (var i=0;i<switches.length;i++)
  {
    html += '<option value="' + switches[i] + '">'+switches[i]+'</option>'
  }
  return html;
}

function drawTable(){
  document.getElementById("authorization").value = data.authorization;
  document.getElementById("server").value = data.server;
  
  var dataTableHtml = '<tr><th id="colIndex"></th><th id="colEntityId">Entity ID</th></tr>';
  
  for(var i=0;i<data.entities.length;i++) {
    dataTableHtml += '<tr>';
    dataTableHtml += '<td style="text-align:center;">' + (i+1) + '</td>';
    
    if (switches.length > 0)
      dataTableHtml += '<td><select id="entity_' + i + '">' + getEntityIdOptionsHtml() + '</select></td>';
    else
      dataTableHtml += '<td><input id="entity_' + i + '" class="entityItem" type="text" value="' + data.entities[i] + '"></td>';
    dataTableHtml += '</tr>';
  }
  document.getElementById("dataTable").innerHTML = dataTableHtml;
  
  for(var i=0;i<data.entities.length;i++) {
    document.getElementById("entity_"+i).value = data.entities[i];
  }
}

function getSwitchEntities(whenDone) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
         if (this.readyState == 4) {
           if (this.status == 200) {
             var json = JSON.parse(this.responseText);
             switches = [];
             for (var i = 0; i < json.length; i++) {
               if (json[i].entity_id.startsWith("switch."))
                  switches.push(json[i].entity_id.substring("switch.".length));
             }
             //console.log(switches);
             if (whenDone)
                whenDone();
               //alert(this.responseText);
           } else {
             switches = [];
             if (whenDone)
                whenDone();
           }
         }
    };
    try {
    xhttp.open("GET", data.server+"/api/states", true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("Authorization", data.authorization);
    xhttp.send("");
    }
    catch {
      switches = [];
      if (whenDone)
        whenDone();
    }
}

function loadConfiguration()
{
  getFile("../cfg.json", function(contents3){
    data = JSON.parse(contents3);
    
    getSwitchEntities(drawTable);
  });
}

function saveConfiguration()
{
  data.authorization = document.getElementById("authorization").value;
  data.server = document.getElementById("server").value;
  var count = data.entities.length;
  data.entities = [];
  //console.log(data.length);
  for (var i=0;i<count; i++) {
    data.entities.push(document.getElementById("entity_"+i).value);
  }
  var dataJSON = JSON.stringify(data,null, 4);
  //console.log(dataJSON);
  postFile("/ha/cfg.json", dataJSON, "text/json")
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
  if (xmlHttp.status != 200) setState("fail to load configuration"); //showHttpError(xmlHttp);
  else
    setState("new configuration loaded");
    //console.log("new configuration loaded");
}

