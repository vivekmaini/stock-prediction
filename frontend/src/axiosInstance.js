import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "http://127.0.0.1:8000/api/v1/",  // ✅ HARD CODE
    headers: {
        "Content-Type": "application/json",
    }
});

// 🔐 Request Interceptor
axiosInstance.interceptors.request.use(
    function (config) {
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
        }
        return config;
    },
    function (error) {
        return Promise.reject(error);
    }
);

// 🔁 Response Interceptor (token refresh)
axiosInstance.interceptors.response.use(
    function (response) {
        return response;
    },
    async function (error) {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem("refreshToken");

            try {
                const response = await axiosInstance.post(
                    "token/refresh/",   // ✅ FIXED (no slash)
                    { refresh: refreshToken }
                );

                localStorage.setItem("accessToken", response.data.access);

                originalRequest.headers["Authorization"] =
                    `Bearer ${response.data.access}`;

                return axiosInstance(originalRequest);

            } catch (err) {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;