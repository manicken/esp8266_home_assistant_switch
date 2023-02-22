window.addEventListener('load', setup);

function setup() {
    
    startDownloadFiles();
  
}
function allDownloaded(files) {
    console.log(files);
    var zip = new JSZip();
    for (var i=0;i<files.length;i++) {
      zip.file(files[i].url, files[i].contents);
    }
    var compression = "STORE";
    zip.generateAsync({ type: "blob", compression}).then(function (blob) {
      saveAs(blob, "fileName.zip");
    });
}
function httpDownloadAsync(url, cbOnOk, cbOnError, timeout)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState != 4) return; // wait for timeout or response
        if (xmlHttp.status == 200)
        {
            if (cbOnOk != undefined)
                cbOnOk(xmlHttp.responseText);
            else
                console.warn(cbOnOk + "response @ " + queryString + ":\n" + xmlHttp.responseText);
        }
        else if (cbOnError != undefined)
            cbOnError(xmlHttp.status + xmlHttp.responseText);
        else
            console.warn(queryString + " did not response = " + xmlHttp.status);
    };
    xmlHttp.open("GET", url, true); // true for asynchronous 
    if (timeout != undefined)
        xmlHttp.timeout = timeout;
    else
        xmlHttp.timeout = 2000;
    xmlHttp.send(null);
}

var filesToDownload = [];
var filesToDownload_index = 0;
var filesToDownload_cbProcess;
var filesToDownload_cbDone;
function startDownloadFiles()
{
    filesToDownload_cbDone = allDownloaded;
    filesToDownload_cbProcess = function(file, index, length) {
      var elem = document.getElementById("filelist");
      var curr = elem.innerHTML;
        elem.innerHTML = curr + "downloaded  ("+ (index+1) + "/" + length +"):  "+file.url + "<br>";
    };
    filesToDownload = [];
    filesToDownload.push({url:"index.html"});
    filesToDownload.push({url:"download.html"});
    filesToDownload.push({url:"download.js"});
    filesToDownload.push({url:"FileSaver.js"});
    filesToDownload.push({url:"jszip.js"});
    filesToDownload.push({url:"btn/cfg/index.html"});
    filesToDownload.push({url:"btn/cfg/main.js"});
    filesToDownload.push({url:"btn/cfg/style.css"});
    filesToDownload.push({url:"ha/cfg/index.html"});
    filesToDownload.push({url:"ha/cfg/main.js"});
    filesToDownload.push({url:"ha/cfg/style.css"});
    filesToDownload.push({url:"tuya/cfg/index.html"});
    filesToDownload.push({url:"tuya/cfg/main.js"});
    filesToDownload.push({url:"tuya/cfg/style.css"});
    
    filesToDownload_index = 0;
    console.log("start downloading");
    downloading = true;
    httpDownloadFilesTask();
}
var downloading = false;
function httpDownloadAsyncFiles(files, cbProcess, cbDone) {
    filesToDownload = files;
    filesToDownload_cbProcess = cbProcess;
    filesToDownload_cbDone = cbDone;
    filesToDownload_index = 0;
    downloading = true;
    httpDownloadFilesTask();
}

function httpDownloadFilesTask()
{
    if (downloading == false) return;
    if (filesToDownload_index < filesToDownload.length) {
        var file = filesToDownload[filesToDownload_index];
        console.log("downloading file: " + file.url);
        httpDownloadAsync(file.url, 
        function(contents) {
            var file = filesToDownload[filesToDownload_index];
            console.log("download completed file: " + file.url);
            file.contents = contents;
            if (filesToDownload_cbProcess != undefined) filesToDownload_cbProcess(file, filesToDownload_index, filesToDownload.length);
            filesToDownload_index++;
            httpDownloadFilesTask();
        },
        function(error){
            var file = filesToDownload[filesToDownload_index];
            if (filesToDownload_cbProcess != undefined) filesToDownload_cbProcess(file, filesToDownload_index, filesToDownload.length);
            console.log("could not download: " + file.url);
            filesToDownload_index++;
            httpDownloadFilesTask();
        });
    }
    else { // download all finished
        console.log("download completed fileCount: " + filesToDownload.length);
        if (filesToDownload_cbDone != undefined) filesToDownload_cbDone(filesToDownload);
    }  
}