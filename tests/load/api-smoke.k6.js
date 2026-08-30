import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
  scenarios: {
    health: {
      executor: "constant-vus",
      vus: Number(__ENV.K6_VUS || 5),
      duration: __ENV.K6_DURATION || "30s",
    },
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
  const res = http.get(`${baseUrl}/api/health`, { tags: { endpoint: "health" } });
  check(res, {
    "health status is 200": (r) => r.status === 200,
    "health response has ok flag": (r) => Boolean(r.json("ok")),
  });
  sleep(1);
}
