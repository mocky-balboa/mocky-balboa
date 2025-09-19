import type { ClientSSEResponse } from "@mocky-balboa/client";
import { BrowserGetSSEProxyParamsFunctionName } from "@mocky-balboa/shared-config";

declare global {
  interface Window {
    [BrowserGetSSEProxyParamsFunctionName]: (url: string) => Promise<ClientSSEResponse>;
  }
}

const OriginalEventSource = window.EventSource;

type EventHandlerQueueItem = {
  type: "addEventListener";
  args: Parameters<EventSource["addEventListener"]>;
} | {
  type: "dispatchEvent";
  args: Parameters<EventSource["dispatchEvent"]>;
} | {
  type: "removeEventListener";
  args: Parameters<EventSource["removeEventListener"]>;
}

class MockEventSource extends EventTarget {
  private realEventSource?: EventSource;

  static CONNECTING = EventSource.CONNECTING;
  static OPEN = EventSource.OPEN;
  static CLOSED = EventSource.CLOSED;

  private _onerror: EventSource["onerror"] = () => {};
  private _onmessage: EventSource["onmessage"] = () => {};
  private _onopen: EventSource["onopen"] = () => {};
  
  private _readyState: EventSource["CONNECTING"] | EventSource["OPEN"] | EventSource["CLOSED"] = EventSource.CONNECTING;

  private _eventHandlerQueue: EventHandlerQueueItem[] = [];

  constructor(private _url: string | URL, private options?: ConstructorParameters<typeof OriginalEventSource>[1]) {
    super();
    void this._connnect();
  }

  get url() {
    return this._url instanceof URL ? this._url.toString() : this._url;
  }

  get withCredentials() {
    return this.options?.withCredentials ?? false;
  }

  get readyState() {
    if (this.realEventSource) {
      return this.realEventSource.readyState;
    }

    return this._readyState;
  }

  get CONNECTING() {
    return EventSource.CONNECTING;
  }

  get OPEN() {
    return EventSource.OPEN;
  }

  get CLOSED() {
    return EventSource.CLOSED;
  }

  get onerror() {
    if (this.realEventSource) {
      return this.realEventSource.onerror;
    }

    return this._onerror;
  }

  get onmessage() {
    if (this.realEventSource) {
      return this.realEventSource.onmessage;
    }

    return this._onmessage;
  }

  get onopen() {
    if (this.realEventSource) {
      return this.realEventSource.onopen;
    }

    return this._onopen;
  }

  set onerror(value: EventSource["onerror"]) {
    if (this.realEventSource) {
      this.realEventSource.onerror = value;
    } else {
      this._onerror = value;
    }
  }

  set onmessage(value: EventSource["onmessage"]) {
    if (this.realEventSource) {
      this.realEventSource.onmessage = value;
    } else {
      this._onmessage = value;
    }
  }

  set onopen(value: EventSource["onopen"]) {
    if (this.realEventSource) {
      this.realEventSource.onopen = value;
    } else {
      this._onopen = value;
    }
  }

  close() {
    if (this.realEventSource) {
      this.realEventSource.close();
    } else {
      this._readyState = EventSource.CLOSED;
    }
  }

  private processEventHandlerQueue(eventSource: EventSource) {
    for (const item of this._eventHandlerQueue) {
      switch (item.type) {
        case "addEventListener":
          eventSource.addEventListener(...item.args);
          break;
        case "dispatchEvent":
          eventSource.dispatchEvent(...item.args);
          break;
        case "removeEventListener":
          eventSource.removeEventListener(...item.args);
          break;
      }
    }

    this._eventHandlerQueue = [];
  }

  private getFullUrl() {
    const urlString = this.url;
    try {
      const url = new URL(urlString);
      return url;
    } catch {
      return new URL(`${window.location.origin}${urlString}`);
    }
  }

  private async _connnect() {
    const result = await window[BrowserGetSSEProxyParamsFunctionName](this.getFullUrl().toString());
    if (this._readyState !== EventSource.CONNECTING) {
      return;
    }

    let eventSource: EventSource;
    if (result.shouldProxy) {
      eventSource = new OriginalEventSource(result.proxyUrl);
    } else {
      console.log("not proxying");
      eventSource = new OriginalEventSource(this.url);
    }

    eventSource.onerror = this._onerror;
    eventSource.onmessage = this._onmessage;
    eventSource.onopen = this._onopen;

    this.realEventSource = eventSource;
    this.processEventHandlerQueue(this.realEventSource);
  }

  addEventListener(...args: Parameters<EventSource["addEventListener"]>) {
    if (this.realEventSource) {
      this.realEventSource.addEventListener(...args);
    } else {
      this._eventHandlerQueue.push({ type: "addEventListener", args });
    }
  }

  dispatchEvent(...args: Parameters<EventSource["dispatchEvent"]>) {
    if (this.realEventSource) {
      return this.realEventSource.dispatchEvent(...args);
    }

    this._eventHandlerQueue.push({ type: "dispatchEvent", args });
    return true;
  }

  removeEventListener(...args: Parameters<EventSource["removeEventListener"]>) {
    if (this.realEventSource) {
      this.realEventSource.removeEventListener(...args);
    } else {
      this._eventHandlerQueue.push({ type: "removeEventListener", args });
    }
  }
}

window.EventSource = MockEventSource as any;
