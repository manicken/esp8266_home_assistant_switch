
#include <Arduino.h>
#include "ArduinoTuya.h"
#include <Adafruit_SSD1306.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "FileHelpers.h"

#ifndef LOCAL_TUYA_H
#define LOCAL_TUYA_H

#define LOCAL_TUYA_JSON_FILENAME "/tuya/settings.json"
#define JSON_NAME_DEVICES     "devices"
#define JSON_NAME_DEVICE_ID   "id"
#define JSON_NAME_DEVICE_KEY  "key"
#define JSON_NAME_DEVICE_HOST "host"
#define JSON_NAME_EXECLIST    "exec"
#define JSON_NAME_EXEC_DEVICE_INDEX "di"
#define JSON_NAME_EXEC_MODE   "mode"
/*
enum TUYA_MODE {
    off = 0,
    on = 1,
    toggle = 2
};*/

namespace LocalTuya
{
    ESP8266WebServer *server;
    Adafruit_SSD1306 *display;
    TuyaDevice plug;
    DynamicJsonDocument jsonDoc(1024);
    String jsonStr = "";

    void setup(ESP8266WebServer &_server);
    void exec(int index);
    void loadJson();
    void set_default_jsonDoc_properties_if_needed();

    void setup(Adafruit_SSD1306 &_display, ESP8266WebServer &_server)
    {
        display = &_display;
        server = &_server;

        server->on("/tuya/settings/load", []() {
            loadJson();
            server->send(200, "text/plain", "OK");
        });
    }

    void exec(int index)
    {
        // failsafes
        if (jsonDoc[JSON_NAME_EXECLIST][index] == nullptr) {
            return;
        }
        if (jsonDoc[JSON_NAME_EXECLIST][index][JSON_NAME_EXEC_DEVICE_INDEX] == nullptr) {
            return;
        }
        if (jsonDoc[JSON_NAME_EXECLIST][index][JSON_NAME_EXEC_MODE] == nullptr) {
            return;
        }

        
        int mode = jsonDoc[JSON_NAME_EXECLIST][index][JSON_NAME_EXEC_MODE];
        int device_index = jsonDoc[JSON_NAME_EXECLIST][index][JSON_NAME_EXEC_DEVICE_INDEX];

        display->setCursor(0,26);
        display->print("                ");
        display->setCursor(0,26);
        /*if (index > (jsonDoc.size()-1)) {
            display->print(index);
            display->print(">");
            display->print(jsonDoc.size());

            return;
        }*/
        if (jsonDoc[JSON_NAME_DEVICES][device_index] == nullptr) {
            display->print(device_index);
            display->print(" device index not found");
            return;
        }
        if (jsonDoc[JSON_NAME_DEVICES][device_index]["id"] == nullptr) {
            display->print(" device id not found");
            return;
        }
        if (jsonDoc[JSON_NAME_DEVICES][device_index]["key"] == nullptr) {
            display->print(" device key not found");
            return;
        }
        if (jsonDoc[JSON_NAME_DEVICES][device_index]["host"] == nullptr) {
            display->print(" device host not found");
            return;
        }
        tuya_error_t err;
        plug.begin(jsonDoc[JSON_NAME_DEVICES][device_index][JSON_NAME_DEVICE_ID], 
                   jsonDoc[JSON_NAME_DEVICES][device_index][JSON_NAME_DEVICE_KEY],
                   jsonDoc[JSON_NAME_DEVICES][device_index][JSON_NAME_DEVICE_HOST]);
         //plug.get();
        if (mode == 0)
            err = plug.set(false);
        else if (mode == 1)
            err = plug.set(true);
        else
            err = plug.toggle();
        if (err == tuya_error_t::TUYA_OK)
            display->print("OK");
        else {
            display->print(err);
             display->print(plug.response);
        }
            
    }

    void loadJson()
    {
        if (!FileHelpers::load_from_file(LOCAL_TUYA_JSON_FILENAME, jsonStr))
        {
            set_default_jsonDoc_properties_if_needed();
        }
        else
        {
            deserializeJson(jsonDoc, jsonStr);
            set_default_jsonDoc_properties_if_needed();
        }
    }

    void set_default_jsonDoc_properties_if_needed()
    {
        
    }
}

#endif