import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { emitNoApiKey, isNoApiKeyError } from "@/lib/api-key-events";

export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({ baseURL });
    this.setUpInterceptors();
  }

  private setUpInterceptors() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        // Any AI call made without a stored OpenAI key → prompt the user for one.
        if (isNoApiKeyError(error)) emitNoApiKey();
        return Promise.reject(error);
      },
    );
  }

  get(url: string, params = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.get(url, { params, ...config });
  }

  post(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.post(url, data, config);
  }

  put(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.put(url, data, config);
  }

  patch(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.patch(url, data, config);
  }

  delete(url: string, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.delete(url, config);
  }
}
