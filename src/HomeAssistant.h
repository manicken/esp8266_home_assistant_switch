#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include "FileHelpers.h"
#include "OLedHelpers.h"

#ifndef HOMEASSISTANT_H
#define HOMEASSISTANT_H

#define HA_JSONDOC_SIZE 2048
#define HOME_ASSISTANT_JSON_FILENAME "/ha/settings.json"
#define HOME_ASSISTANT_JSON_LOAD_URL "/ha/settings/load"
#define HA_JSON_NAME_DEBUG         "debug"
#define HA_JSON_NAME_AUTHORIZATION "authorization"
#define HA_JSON_NAME_SERVER        "server"
#define HA_JSON_NAME_ENTITIES      "entities"

namespace HomeAssistant {

    enum SWITCH_MODE {
        off = (0),
        on = (1),
        toggle = (2)
    };

    ESP8266WebServer *server;
    Adafruit_SSD1306 *display;
    HTTPClient http;
    WiFiClient client;
    DynamicJsonDocument jsonDoc(HA_JSONDOC_SIZE);
    String jsonStr = "";
    bool debug = false;

    void exec(int index, int mode);
    void loadJson();
    void set_default_jsonDoc_properties_if_needed();

    void api_services_switch(const String &mode, const String &id);

    void setup(Adafruit_SSD1306 &_display, ESP8266WebServer &_server)
    {
        display = &_display;
        server = &_server;

        server->on(HOME_ASSISTANT_JSON_LOAD_URL, []() {
            loadJson();
            server->send(200, "text/plain", "OK");
        });
        loadJson();
    }
    
    void loadJson()
    {
        if (!FileHelpers::load_from_file(HOME_ASSISTANT_JSON_FILENAME, jsonStr))
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
        bool changed = false;
        if (jsonDoc.containsKey(HA_JSON_NAME_AUTHORIZATION) == false) {
            jsonDoc[HA_JSON_NAME_AUTHORIZATION] = "Bearer";
            changed = true;
        }
        if (jsonDoc.containsKey(HA_JSON_NAME_SERVER) == false) {
            jsonDoc[HA_JSON_NAME_SERVER] = "";
            changed = true;
        }
        if (jsonDoc.containsKey(HA_JSON_NAME_DEBUG) == true) debug = true;
        else debug = false;

        if (changed == true)
        {
            jsonStr = "";
            serializeJsonPretty(jsonDoc, jsonStr);
            FileHelpers::write_to_file(HOME_ASSISTANT_JSON_FILENAME, jsonStr);
        }
    }

    void exec(int index, int mode)
    {
        String id = jsonDoc[HA_JSON_NAME_ENTITIES][index];
        if (id == nullptr) { DEBUG_UART.print("ha exec cannot find entity @ index:"); DEBUG_UART.println(index); return; }

        if (debug) {
            DEBUG_UART.print("index:");
            DEBUG_UART.println(index);
            DEBUG_UART.print("entity id:");
            DEBUG_UART.println(id);
            DEBUG_UART.print("mode:");
            DEBUG_UART.println(mode);
            return;
        }

        if (mode == (int)SWITCH_MODE::toggle)
        {
            api_services_switch(id, "toggle");
        }
        else if (mode == (int)SWITCH_MODE::on)
        {
            api_services_switch(id, "turn_on");
        }
        else if (mode == (int)SWITCH_MODE::off)
        {
            api_services_switch(id, "turn_off");
        }
    }

    void setHomeAssistantHttpHeader()
    {
        String auth = jsonDoc[HA_JSON_NAME_AUTHORIZATION];
        //DEBUG_UART.println(auth);
        http.addHeader("authorization", auth);
        http.addHeader("Content-Type", "application/json");
    }

    bool get_HomeAssistant_switch_state(const String &entityId) {
        
        String url = jsonDoc[HA_JSON_NAME_SERVER] + "/api/states/" + entityId;
        http.begin(client, url);
        setHomeAssistantHttpHeader();
        int httpCode = http.GET();
        
        http.end();

        OLedHelpers::displayPrintHttpState(httpCode);

        if (httpCode>0) {
            String payload = http.getString();
            http.end();

            DynamicJsonDocument doc(1024);

            deserializeJson( doc, payload);

            JsonObject obj = doc.as<JsonObject>();

            if (obj == NULL) {
                display->setCursor(0,8);
                display->print("json obj null");
                display->display();
                return false;
            }
            String state = obj["state"];

            if (state == NULL) {
                display->setCursor(0,8);
                display->print("json state var null");
                display->display();
                return false;
            } 
            if (state == "ON") return true;

        }
        else
            http.end();

        return false;
    }

    void api_services_switch(const String &mode, const String &id)
    {
        String url = jsonDoc[HA_JSON_NAME_SERVER] + "/api/services/switch/" + mode;
        http.begin(client, url);

        setHomeAssistantHttpHeader();

        int httpCode = 0;

        httpCode = http.POST("{\"entity_id\":\"switch."+id+"\"}");
        http.end();

        OLedHelpers::displayPrintHttpState(httpCode);
    }

}

#endif