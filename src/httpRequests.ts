import fetch from "node-fetch";
import axios from "axios";

export enum HttpMethod {
  Get = "get",
  Post = "post",
  Delete = "delete",
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
interface HttpRequest {
  url: string;
  method: HttpMethod;
  body?: Record<string, any>;
  headers?: object;
}

export async function sendRequest<T>({
  url,
  method,
  body,
  headers = {},
}: HttpRequest): Promise<T> {
  const response = await axios({
    url,
    method,
    headers: {
      ...headers,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: JSON.stringify(body),
  });

  let jsonResponse;
  try {
    jsonResponse = await response.data;
  } catch (error) {
    if (response.status !== 200) {
      throw new Error(response.statusText);
    }
  }

  if (response.status === 200) {
    return jsonResponse as T;
  }
  if (jsonResponse.error) {
    throw new Error(jsonResponse.error);
  }
  if (jsonResponse.message) {
    throw new Error(jsonResponse.message);
  }
  if (jsonResponse.msg) {
    throw new Error(jsonResponse.msg);
  }
  if (jsonResponse.data) {
    throw new Error(jsonResponse.data);
  }
  if (jsonResponse.detail) {
    throw new Error(jsonResponse.detail);
  }
  if (jsonResponse.message) {
    throw new Error(jsonResponse.message);
  }
  if (jsonResponse.nonFieldErrors) {
    throw new Error(jsonResponse.nonFieldErrors);
  }
  if (jsonResponse.delegate) {
    throw new Error(jsonResponse.delegate);
  }
  throw new Error(response.statusText);
}
