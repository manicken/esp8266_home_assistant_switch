window.addEventListener('load', setup);

function setup() {
  getModes(loadSettings);
}

function loadSettings()
{
  loadFile("../settings.json");
}

var modes = [];

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

function loadFile(path){
  xmlHttp = new XMLHttpRequest();
  xmlHttp.onload = fileLoaded;
  xmlHttp.open("GET", path, true);
  xmlHttp.send(null);
}

function getOptionsHtml()
{
    var html = "";
    for (var i=0;i<modes.length;i++)
    {
        html += '<option value="' + i + '">'+modes[i]+'</option>'
    }
    return html;
}

function fileLoaded(){

  if (xmlHttp.status == 200) {

    var settings = JSON.parse(xmlHttp.responseText);
    
    document.getElementById("authorization").value = settings.authorization;
    document.getElementById("server").value = settings.server;
    
    var itemsHtml = "";
    for(var i=0;i<settings.items.length;i++) {
      itemsHtml += '<div class="item">';
      itemsHtml += '<label class="itemlabel">Item '+(i+1)+'</label>';
      itemsHtml += '<div class="item_part">';
      itemsHtml += '<label for="item' + i +'id">ID:</label>';
      itemsHtml += '<input type="text" id="item' + i + 'id" name="item'+i+'id" value="'+settings.items[i].id+'">';
      itemsHtml += '</div>';
     // itemsHtml += '<br><br>';
     itemsHtml += '<div class="item_part">';
      itemsHtml += '<label for="item' + i +'mode">Mode:</label>';
      itemsHtml += '<select id="item' +i + 'mode">';
      itemsHtml += getOptionsHtml();
      itemsHtml += '</select>';
      itemsHtml += '</div>';
      itemsHtml += '</div>';
    }
    document.getElementById("items").innerHTML = itemsHtml;
    //console.log(itemsHtml);
    for(var i=0;i<settings.items.length;i++) {
        document.getElementById("item"+i+"mode").value = settings.items[i].mode;
    }
    /*
    document.getElementById("ledCount").value = settings.ledCount;
    document.getElementById("mode").value = settings.mode;
    document.getElementById("color").value = settings.color;
    document.getElementById("speed").value = settings.speed;
    document.getElementById("brightness").value = settings.brightness;
    
    if (settings.IF_speed != undefined)
      document.getElementById("IF_speed").value = settings.IF_speed;
    else
     document.getElementById("IF_speed").value = "KHZ800";
    
    if (settings.LED_configuration != undefined)
      document.getElementById("LED_configuration").value = settings.LED_configuration;
    else
      document.getElementById("LED_configuration").value = "RGB";
    */
    //console.log(settings);
  }
}

function saveSettings()
{
  var settings = {};
  settings.count=8;
  settings.authorization = document.getElementById("authorization").value ;
  settings.server = document.getElementById("server").value;
  settings.items = [];
  
  for (var i = 0;i<8;i++) {
    settings.items[i] = {id:document.getElementById("item"+i+"id").value, 
                         mode:parseInt(document.getElementById("item"+i+"mode").value)}
  }
  
  var settingsJSON = JSON.stringify(settings,null, 4);
  
  //console.log(settingsJSON);
  
  postFile("ha/settings.json", settingsJSON, "text/json")
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

