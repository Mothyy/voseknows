import axios from "axios";
import { Platform } from "react-native";

// Detect execution environment to set the correct backend URL
// Android Emulator uses 10.0.2.2 to access the host machine
// iOS Simulator uses localhost
// Physical devices need the LAN IP of the machine running the backend

const DEV_BACKEND_PORT = "3001";
const ANDROID_HOST = "10.0.2.2";
const IOS_HOST = "localhost";

const getBaseUrl = () => {
    if (Platform.OS === "android") {
        return `http://${ANDROID_HOST}:${DEV_BACKEND_PORT}/api`;
    } else if (Platform.OS === "ios") {
        return `http://${IOS_HOST}:${DEV_BACKEND_PORT}/api`;
    }
    // Default fallback (e.g. for web or physical device if configured manually)
    return `http://localhost:${DEV_BACKEND_PORT}/api`;
};

const apiClient = axios.create({
    baseURL: getBaseUrl(),
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

export default apiClient;
