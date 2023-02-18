
#include <Arduino.h>
#include "ArduinoTuya.h"
#include <Adafruit_SSD1306.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "FileHelpers.h"

#ifndef LOCAL_TUYA_H
#define LOCAL_TUYA_H

#define LOCAL_TUYA_JSONDOC_SIZE 2048
#define LOCAL_TUYA_JSON_FILENAME "/tuya/cfg.json"
#define LOCAL_TUYA_JSON_LOAD_URL "/tuya/cfg/load"
#define LT_JSON_NAME_DEVICE_ID   "id"
#define LT_JSON_NAME_DEVICE_KEY  "key"
#define LT_JSON_NAME_DEVICE_HOST "host"

namespace LocalTuya
{
    enum SWITCH_MODE {
        off = (0),
        on = (1),
        toggle = (2)
    };

    ESP8266WebServer *server;
    Adafruit_SSD1306 *display;
    TuyaDevice plug;
    DynamicJsonDocument jsonDoc(LOCAL_TUYA_JSONDOC_SIZE);
    String jsonStr = "";

    void setup(ESP8266WebServer &_server);
    void exec(int index, int mode);
    void loadJson();
    void set_default_jsonDoc_properties_if_needed();

    void setup(Adafruit_SSD1306 &_display, ESP8266WebServer &_server)
    {
        display = &_display;
        server = &_server;

        server->on(LOCAL_TUYA_JSON_LOAD_URL, []() {
            loadJson();
            server->send(200, "text/plain", "OK");
        });
        loadJson();
    }

    void exec(int index, int mode)
    {
        display->setCursor(0,26);
        display->print("                ");
        display->setCursor(0,26);
        
        if (jsonDoc[index] == nullptr) {
            display->print(index);
            display->print(" device index not found");
            return;
        }
        if (jsonDoc[index][LT_JSON_NAME_DEVICE_ID] == nullptr) {
            display->print(" device id not found");
            return;
        }
        if (jsonDoc[index][LT_JSON_NAME_DEVICE_KEY] == nullptr) {
            display->print(" device key not found");
            return;
        }
        if (jsonDoc[index][LT_JSON_NAME_DEVICE_HOST] == nullptr) {
            display->print(" device host not found");
            return;
        }
        tuya_error_t err;
        plug.begin(jsonDoc[index][LT_JSON_NAME_DEVICE_ID], 
                   jsonDoc[index][LT_JSON_NAME_DEVICE_KEY],
                   jsonDoc[index][LT_JSON_NAME_DEVICE_HOST]);
        
        if (mode == (int)SWITCH_MODE::off)
            err = plug.set(false);
        else if (mode == (int)SWITCH_MODE::on)
            err = plug.set(true);
        else if (mode == (int)SWITCH_MODE::toggle)
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