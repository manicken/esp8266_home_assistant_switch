

#ifndef _TuyaLocal
#define _TuyaLocal


// Tuya Command Types
#define TUYA_UDP 0  // HEART_BEAT_CMD
#define TUYA_AP_CONFIG 1  // PRODUCT_INFO_CMD
#define TUYA_ACTIVE 2  // WORK_MODE_CMD
#define TUYA_BIND 3  // WIFI_STATE_CMD - wifi working status
#define TUYA_RENAME_GW 4  // WIFI_RESET_CMD - reset wifi
#define TUYA_RENAME_DEVICE 5  // WIFI_MODE_CMD - Choose smartconfig/AP mode
#define TUYA_UNBIND 6  // DATA_QUERT_CMD - issue command
#define TUYA_CONTROL 7  // STATE_UPLOAD_CMD
#define TUYA_STATUS 8  // STATE_QUERY_CMD
#define TUYA_HEART_BEAT 9
#define TUYA_DP_QUERY 10  // UPDATE_START_CMD - get data points
#define TUYA_QUERY_WIFI 11  // UPDATE_TRANS_CMD
#define TUYA_TOKEN_BIND 12  // GET_ONLINE_TIME_CMD - system time (GMT)
#define TUYA_CONTROL_NEW 13  // FACTORY_MODE_CMD
#define TUYA_ENABLE_WIFI 14  // WIFI_TEST_CMD
#define TUYA_DP_QUERY_NEW 16
#define TUYA_SCENE_EXECUTE 17
#define TUYA_UPDATEDPS 18  // Request refresh of DPS
#define TUYA_UDP_NEW 19
#define TUYA_AP_CONFIG_NEW 20
#define TUYA_GET_LOCAL_TIME_CMD 28
#define TUYA_WEATHER_OPEN_CMD 32
#define TUYA_WEATHER_DATA_CMD 33
#define TUYA_STATE_UPLOAD_SYN_CMD 34
#define TUYA_STATE_UPLOAD_SYN_RECV_CMD 35
#define TUYA_HEART_BEAT_STOP 37
#define TUYA_STREAM_TRANS_CMD 38
#define TUYA_GET_WIFI_STATUS_CMD 43
#define TUYA_WIFI_CONNECT_TEST_CMD 44
#define TUYA_GET_MAC_CMD 45
#define TUYA_GET_IR_STATUS_CMD 46
#define TUYA_IR_TX_RX_TEST_CMD 47
#define TUYA_LAN_GW_ACTIVE 240
#define TUYA_LAN_SUB_DEV_REQUEST 241
#define TUYA_LAN_DELETE_SUB_DEV 242
#define TUYA_LAN_REPORT_SUB_DEV 243
#define TUYA_LAN_SCENE 244
#define TUYA_LAN_PUBLISH_CLOUD_CONFIG 245
#define TUYA_LAN_PUBLISH_APP_CONFIG 246
#define TUYA_LAN_EXPORT_APP_CONFIG 247
#define TUYA_LAN_PUBLISH_SCENE_PANEL 248
#define TUYA_LAN_REMOVE_GW 249
#define TUYA_LAN_CHECK_GW_UPDATE 250
#define TUYA_LAN_GW_UPDATE 251
#define TUYA_LAN_SET_GW_CHANNEL 252

//#include <WiFi.h>
#include <WiFiClient.h>
#include <SPI.h>


#define TL_ERROR -1
#define TL_OK 0
#define TL_EMPTY 1

class tuyaLocal
{

public:
/************************************************************************
 *									*
 *	Class construct							*
 *									*
 ************************************************************************/
	tuyaLocal(String hostname,String device,String key,const char *protocol="3.3",int port=6668 );
	tuyaLocal();
	~tuyaLocal();
	void begin(String hostname,String device,String key,const char *protocol="3.3",int port=6668 );
	bool getDps(String &);
	bool setDps(String &,String& result);

	static bool dpsTrue(String dps,const char *field);
	static bool dpsFalse(String dps,const char *field);
	bool connect( const uint8_t retries = 1,const int timeout = 200);
	bool connected();
	int send(unsigned char* buffer, const unsigned int size);
	int receive(unsigned char* buffer, const unsigned int maxsize, const unsigned int minsize = 28);
	void disconnect();
	String getProtocol(){
		return m_protocol;
	}
	bool reconnect();	
private:
	int BuildTuyaMessage(unsigned char *buffer, const uint8_t command, String &payload,bool encrypt=false);
	int DecodeTuyaMessage(unsigned char* buffer, const int size, String &result);
	String m_hostname;
	int m_portnumber;
	uint8_t m_retries;
	int    m_timeout;
	String m_protocol;
	String m_key;
	String m_device_id;

	WiFiClient *client;

	const uint8_t MESSAGE_SEND_HEADER[16] = {0,0,0x55,0xaa,0,0,0,0,0,0,0,0,0,0,0,0};
	const uint8_t MESSAGE_SEND_TRAILER[8] = {0,0,0,0,0,0,0xaa,0x55};
	const uint8_t PROTOCOL_33_HEADER[15] = {'3','.','3',0,0,0,0,0,0,0,0,0,0,0,0};
	
};

#endif

