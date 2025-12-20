import axios from "axios";
import type { AxiosInstance } from "axios";

// The base URL for the SISS Developer Sandbox API.
// In a real application, you might have different URLs for production.
const SISS_API_BASE_URL = "https://dev.sissdata.com.au";

/**
 * Creates a pre-configured Axios instance for making requests to the SISS API.
 * This function encapsulates the authentication logic for SISS.
 *
 * @param {string} apiKey - The `x-api-key` for the SISS connection.
 * @param {string} customerId - The `customer-id` for the specific user/connection.
 * @returns {AxiosInstance} A configured Axios client ready to make requests.
 */
const createSissClient = (apiKey: string, customerId: string): AxiosInstance => {
    if (!apiKey || !customerId) {
        throw new Error("SISS API key and customer ID are required to create a client.");
    }

    return axios.create({
        baseURL: SISS_API_BASE_URL,
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "customer-id": customerId,
        },
    });
};

export default createSissClient;
