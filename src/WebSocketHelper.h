
#ifndef WEBSOCKET_HELPER_H
#define WEBSOCKET_HELPER_H

#include <Arduino.h>
#include <WebSocketsServer.h>

namespace WebSocketHelper {
    WebSocketsServer *webSocket;
    void sendText(String &payload) {
        if (webSocket == nullptr) return;
        int count = webSocket->connectedClients();
        if (count > 0) {
            for (int i=0;i<count;i++)
                webSocket->sendTXT(i, payload);
        }
    }
}

#endif