#include <LittleFS.h>
#include <ESP8266WebServer.h>
#ifndef FILEHELPERS_H
#define FILEHELPERS_H

namespace FileHelpers {

    bool load_from_file(String file_name, String &contents);
    bool write_to_file(String file_name, String contents);
    void server_handle_list_files();
    bool server_handleFileRead();
    String getContentType(String filename);

    void setup() {

        Main::webServer.on("/listFiles", []() {
            FileHelpers::server_handle_list_files();
        });
        
        Main::webServer.on("/formatLittleFs", []() {
            if (LittleFS.format()) Main::webServer.send(200,"text/html", "Format OK");
            else Main::webServer.send(200,"text/html", "format Fail");
        });
        Main::webServer.onNotFound([]() {                              // If the client requests any URI
            if (!FileHelpers::server_handleFileRead())                  // send it if it exists
                Main::webServer.send(404, "text/plain", "404: Not Found"); // otherwise, respond with a 404 (Not Found) error
        });
    }
    bool load_from_file(String file_name, String &contents) {
        contents = "";
        
        File this_file = LittleFS.open(file_name, "r");
        if (!this_file) { // failed to open the file, retrn empty result
            return false;
        }
        while (this_file.available()) {
            contents += (char)this_file.read();
        }
        
        this_file.close();
        return true;
    }

    bool write_to_file(String file_name, String contents) {  
        File this_file = LittleFS.open(file_name, "w");
        if (!this_file) { // failed to open the file, return false
            return false;
        }
        int bytesWritten = this_file.print(contents);
        
        if (bytesWritten == 0) { // write failed
            return false;
        }
        
        this_file.close();
        return true;
    }

    
    void server_handle_list_files()
    {
        String str = "Files:\n";
        Dir dir = LittleFS.openDir("/");
        while (dir.next()) {
            str += dir.fileName();
            str += " / ";
            str += dir.fileSize();
            str += "\n";
        }
        Main::webServer.send(200, "text/plain", str);
    }
    String getContentType(String filename) { // convert the file extension to the MIME type
        if (filename.endsWith(".html")) return "text/html";
        else if (filename.endsWith(".css")) return "text/css";
        else if (filename.endsWith(".js")) return "application/javascript";
        else if (filename.endsWith(".ico")) return "image/x-icon";
        else if (filename.endsWith(".gz")) return "application/x-gzip";
        return "text/plain";
    }
    bool server_handleFileRead() { // send the right file to the client (if it exists)
        String path = Main::webServer.uri();
        Serial.println("handleFileRead: " + path);
        if (path.endsWith("/")) path += "index.html";          // If a folder is requested, send the index file
        String contentType = getContentType(path);             // Get the MIME type
        String pathWithGz = path + ".gz";
        if (LittleFS.exists(pathWithGz) || LittleFS.exists(path)) { // If the file exists, either as a compressed archive, or normal
            if (LittleFS.exists(pathWithGz))                         // If there's a compressed version available
            path += ".gz";                                         // Use the compressed verion
            File file = LittleFS.open(path, "r");                    // Open the file
            size_t sent = Main::webServer.streamFile(file, contentType);    // Send it to the client
            file.close();                                          // Close the file again
            Serial.println(String("\tSent file: ") + path);
            return true;
        }
        Serial.println(String("\tFile Not Found: ") + path);   // If the file doesn't exist, return false
        return false;
    }
}
#endif