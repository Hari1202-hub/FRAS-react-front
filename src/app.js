import "./bootstrap";
//export const BASEURL = 'http://localhost/fras/api/';
// export const BASEURL = 'http://127.0.0.1:8000/api/';

// staging
// export const BASEURL = "http://44.204.69.221/api/";
// export const BASEPATH = "http://44.204.69.221/";

// production
export const BASEURL = 'http://3.88.178.47/api/';
export const BASEPATH = 'http://3.88.178.47/';
export const BASENAME = "/";
export const TOKEN = () => localStorage.getItem("access_token") || "";
