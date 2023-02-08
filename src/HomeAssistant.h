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
char modes[] PROGMEM = R"=====(
    ["Off","On","Toggle"]
)=====";

enum SWITCH_MODE {
    off = 0,
    on = 1,
    toggle = 2
};


namespace HomeAssistant {

    ESP8266WebServer *server;
    Adafruit_SSD1306 *display;
    HTTPClient http;
    WiFiClient client;

    void execKeyPress(int index);
    void loadHomeAssistantSettings();
    void set_default_jsonDoc_settings_if_needed();

    void HomeAssistant_switch_state_turn_off(const String &entityId);
    void HomeAssistant_switch_state_turn_on(const String &entityId);
    void HomeAssistant_switch_state_toggle(const String &entityId);

    void setup(Adafruit_SSD1306 &_display, ESP8266WebServer &_server)
    {
        display = &_display;
        server = &_server;

        server->on("/modes", []() {
            server->send(200, "text/plain", modes);
        });
        server->on("/ha/settings/load", []() {
            loadHomeAssistantSettings();
            server->send(200, "text/plain", "OK");
        });
    }
    
    DynamicJsonDocument jsonDoc_settings(1024);
    String jsonStr_settings = "";
    #define HOME_ASSISTANT_SETTINGS_FILENAME "/ha/settings.json"
    void loadHomeAssistantSettings()
    {
        if (!FileHelpers::load_from_file(HOME_ASSISTANT_SETTINGS_FILENAME, jsonStr_settings))
        {
            set_default_jsonDoc_settings_if_needed();
        }
        else
        {
            deserializeJson(jsonDoc_settings, jsonStr_settings);
            set_default_jsonDoc_settings_if_needed();
        }
    }

    void set_default_jsonDoc_settings_if_needed()
    {
        bool changed = false;
        if (jsonDoc_settings.containsKey("count") == false) {
            jsonDoc_settings["count"] = 8;
            changed = true;
        }
        if (jsonDoc_settings.containsKey("authorization") == false) {
            jsonDoc_settings["authorization"] = "Bearer";
            changed = true;
        }
        if (jsonDoc_settings.containsKey("server") == false) {
            jsonDoc_settings["server"] = "";
            changed = true;
        }

        for (int i=0;i<8;i++) {
            if (jsonDoc_settings["items"][i].containsKey("id") == false) {
                jsonDoc_settings["items"][i]["id"] = "item1";
                changed = true;
            }
            if (jsonDoc_settings["items"][i].containsKey("mode") == false) {
                jsonDoc_settings["items"][i]["mode"] = SWITCH_MODE::toggle;
                changed = true;
            }
        }
        if (changed == true)
        {
            jsonStr_settings = "";
            serializeJsonPretty(jsonDoc_settings, jsonStr_settings);
            FileHelpers::write_to_file(HOME_ASSISTANT_SETTINGS_FILENAME, jsonStr_settings);
        }
    }

    void execKeyPress(int index)
    {
        if (jsonDoc_settings["items"][index]["mode"] == (int)SWITCH_MODE::toggle)
        {
            HomeAssistant_switch_state_toggle(jsonDoc_settings["items"][index]["id"]);
        }
        else if (jsonDoc_settings["items"][index]["mode"] == (int)SWITCH_MODE::on)
        {
            HomeAssistant_switch_state_turn_on(jsonDoc_settings["items"][index]["id"]);
        }
        else if (jsonDoc_settings["items"][index]["mode"] == (int)SWITCH_MODE::off)
        {
            HomeAssistant_switch_state_turn_off(jsonDoc_settings["items"][index]["id"]);
        }
    }

    void setHomeAssistantHttpHeader()
    {
        String auth = jsonDoc_settings["authorization"];
        //DEBUG_UART.println(auth);
        http.addHeader("authorization", auth );//F("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIzN2NlMjg4ZGVkMWE0OTBhYmIzNDYxMDNiM2YzMzIzNCIsImlhdCI6MTY2OTkwNjI1OCwiZXhwIjoxOTg1MjY2MjU4fQ.XP-8H5PRQG6tJ8MBYmiN0I4djs-KpahZliTrnPTvlcQ"));
        http.addHeader("Content-Type", "application/json");
    }

    bool get_HomeAssistant_switch_state(const String &entityId) {
        
        String url = jsonDoc_settings["server"] + "/api/states/" + entityId;
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

    void sendTo_HomeAssistant_api(const String &entityId, String url)
    {
        http.begin(client, url);

        setHomeAssistantHttpHeader();

        int httpCode = 0;

        httpCode = http.POST("{\"entity_id\":\""+entityId+"\"}");
        http.end();

        OLedHelpers::displayPrintHttpState(httpCode);
    }

    void HomeAssistant_switch_state_toggle(const String &entityId)
    {
        String url = jsonDoc_settings["server"] + "/api/services/switch/toggle";
        sendTo_HomeAssistant_api(entityId, url);
    }

    void HomeAssistant_switch_state_turn_on(const String &entityId)
    {
        String url = jsonDoc_settings["server"] + "/api/services/switch/turn_on";
        sendTo_HomeAssistant_api(entityId, url);
    }

    void HomeAssistant_switch_state_turn_off(const String &entityId)
    {
        String url = jsonDoc_settings["server"] + "/api/services/switch/turn_off";
        sendTo_HomeAssistant_api(entityId, url);
    }
}

#endif