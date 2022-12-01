//
//    FILE: TCP2UART.cpp
// VERSION: 
// PURPOSE: 
// LICENSE: 


#include "TCP2UART.h"
#include <WiFiClient.h>
#include <WiFiServer.h>

WiFiClient bridgeClient;
WiFiServer bridgeServer(TCP2UART_BRIDGE_TCPPORT);
WiFiServer bridgeConfigServer(TCP2UART_CONFIG_TCPPORT);
String bridgeConfigRx = "";

void TCP2UART::begin()
{
    serialRxBuff = (uint8_t *) malloc(rxBuffSize);
    tcpRxBuff = (uint8_t *) malloc(rxBuffSize);
	//start UART
    TCP2UART_SERIAL.begin(serialBaud, serialConfig);
    bridgeServer.begin();
    bridgeServer.setNoDelay(true);

    bridgeConfigServer.begin();
    bridgeConfigServer.setNoDelay(true);
}

void TCP2UART::BridgeMainTask()
{
    if(TCP2UART_SERIAL.available())
    {
        // need to empty Serial buffer quicker by using "readBytesUntil"
        serialRxDataLength = TCP2UART_SERIAL.readBytesUntil('\n', serialRxBuff, rxBuffSize);
        serialRxBuff[serialRxDataLength++] = '\n';
        if (bridgeClient && bridgeClient.connected())
            bridgeClient.write((const uint8_t*)serialRxBuff, serialRxDataLength);
        uartMessageReceived = true;
    }

    if (bridgeConfigServer.hasClient()) // new connection
    {
        if (bridgeClient) bridgeClient.stop();
        bridgeClient = bridgeConfigServer.available();
        TCP2UART_SERIAL.end();
        Serial1.println(F("bridge Config Client Connected!"));
        bridgeInConfigMode = true;
    }
    if (bridgeServer.hasClient() && !bridgeInConfigMode) // new connection
    {
        if (bridgeClient) bridgeClient.stop();
        bridgeClient = bridgeServer.available();
        Serial1.println(F("bridge Client Connected!"));
        bridgeClientConnected = true;
    }
    
    if (bridgeClient && bridgeClient.connected())
    {
        if (bridgeClient.available())
        {
            if (bridgeInConfigMode)
            {
                bridgeConfigRx = bridgeClient.readStringUntil('\n');
                if (bridgeConfigRx.startsWith("baud"))
                {
                    serialBaud = bridgeConfigRx.substring(4).toInt();
                    Serial1.print(F("bridge config - serialBaud set to:"));
                    Serial1.print(serialBaud);
                    Serial1.println("");
                }
                if (bridgeConfigRx.startsWith("cfg_"))
                {
                    bridgeConfigRx_parse_SerialSetting();
                }
                else 
                {
                    Serial1.print(F("bridge config - unknown command:"));
                    Serial1.println(bridgeConfigRx);
                }
            }
            else
            {
                tcpRxDataLength = bridgeClient.readBytesUntil('\n', tcpRxBuff, rxBuffSize);
                tcpRxBuff[tcpRxDataLength++] = '\n';
                TCP2UART_SERIAL.write((const uint8_t*)tcpRxBuff, tcpRxDataLength);
            }
        }
    }
    else
    {
        if (bridgeInConfigMode)
        {
            bridgeInConfigMode = false;
            TCP2UART_SERIAL.begin(serialBaud, serialConfig);
            Serial1.println(F("bridge Config Client Disconnected!"));
        }
        if (bridgeClientConnected)
        {
            bridgeClientConnected = false;
            Serial1.println(F("bridge Client Disconnected!"));
        }
    }

}
void TCP2UART::bridgeConfigRx_parse_SerialSetting(void)
{
    uint8_t bitCfg = 0x00;
    uint8_t parityCfg = 0x00;
    uint8_t stopbitCfg = 0x00;

    if (bridgeConfigRx[4] == '5')
        bitCfg = UART_NB_BIT_5;
    else if (bridgeConfigRx[4] == '6')
        bitCfg = UART_NB_BIT_6;
    else if (bridgeConfigRx[4] == '7')
        bitCfg = UART_NB_BIT_7;
    else if (bridgeConfigRx[4] == '8')
        bitCfg = UART_NB_BIT_8;
    else
    {
        bridgeClient.println("parse error - data bits (only 5, 6, 7 & 8) supported!");
        return;
    }

    if (bridgeConfigRx[5] == 'N')
        parityCfg = UART_PARITY_NONE;
    else if (bridgeConfigRx[5] == 'E')
        parityCfg = UART_PARITY_EVEN;
    else if (bridgeConfigRx[5] == 'O')
        parityCfg = UART_PARITY_ODD;
    else
    {
        bridgeClient.println("parse error - parity (only N, E & O) supported!");
        return;
    }

    if (bridgeConfigRx[6] == '1')
        stopbitCfg = UART_NB_STOP_BIT_1;
    else if (bridgeConfigRx[6] == '2')
        stopbitCfg = UART_NB_STOP_BIT_2;
    else
    {
        bridgeClient.println("parse error - stop bits (only 1 & 2) supported!");
        return;
    } 

    serialConfig = (SerialConfig)(bitCfg | parityCfg | stopbitCfg);
    
}

/*
void TCP2UART::serialTransmit(const char *message, THandlerFunction fn)
{
    _serialReceiveHandler_callback = fn;
    TCP2UART_SERIAL.write(message);
}

void TCP2UART::serialTransmit(String message, THandlerFunction fn)
{
    _serialReceiveHandler_callback = fn;
    TCP2UART_SERIAL.print(message);
}

boolean TCP2UART::serialReceive_Task()
{
    //check UART for data
    if(TCP2UART_SERIAL.available())
    {
        // need to empty Serial buffer quicker by using "readBytesUntil"
        serialRxDataLength = TCP2UART_SERIAL.readBytesUntil('\n', serialRxBuff, rxBuffSize);
        serialRxBuff[serialRxDataLength++] = '\n'; 
        
        if (_serialReceiveHandler_callback)
            _serialReceiveHandler_callback();
    }
}
*/
//
// END OF FILE
//
