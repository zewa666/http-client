import {Headers} from './headers';
import {HttpResponseMessage} from './http-response-message';
import {
  uriTransformer,
  timeoutTransformer,
  callbackParameterNameTransformer
} from './transformers';

export class JSONPRequestMessage {
  constructor(uri, callbackParameterName){
    this.method = 'JSONP';
    this.uri = uri;
    this.content = undefined;
    this.headers = new Headers();
    this.responseType = 'jsonp';
    this.callbackParameterName = callbackParameterName;
  }
}

class JSONPXHR {
  open(method, uri){
    this.method = method;
    this.uri = uri;
    this.callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
  }

  send(){
    var uri = this.uri + (this.uri.indexOf('?') >= 0 ? '&' : '?') + this.callbackParameterName + '=' + this.callbackName;

    window[this.callbackName] = (data) => {
      delete window[this.callbackName];
      document.body.removeChild(script);

      if(this.status === undefined){
        this.status = 200;
        this.statusText = 'OK';
        this.response = data;
        this.onload(this);
      }
    };

    var script = document.createElement('script');
    script.src = uri;
    document.body.appendChild(script);

    if(this.timeout !== undefined){
      setTimeout(() => {
        if(this.status === undefined){
          this.status = 0;
          this.ontimeout(new Error('timeout'));
        }
      }, this.timeout);
    }
  }

  abort(){
    if(this.status === undefined){
      this.status = 0;
      this.onabort(new Error('abort'));
    }
  }

  setRequestHeader(){}
}

export class JSONPRequestMessageProcessor {
  constructor(){
    this.transformers = [
      uriTransformer,
      timeoutTransformer,
      callbackParameterNameTransformer
    ];
  }

  abort(){
    this.xhr.abort();
  }

  process(client, message){
    return new Promise((resolve, reject) => {
      var xhr = this.xhr = new JSONPXHR();

      this.transformers.forEach(x => x(client, this, message, xhr));
      xhr.open(message.method, message.fullUri || message.uri, true);

      xhr.onload = (e) => {
        var response = new HttpResponseMessage(message, xhr, message.responseType, message.reviver || client.reviver);
        if(response.isSuccess){
          resolve(response);
        }else{
          reject(response);
        }
      };

      xhr.ontimeout = (e) => {
        reject(new HttpResponseMessage(message, {
          response:e,
          status:xhr.status,
          statusText:xhr.statusText
        }, 'timeout'));
      };

      xhr.onabort = (e) => {
        reject(new HttpResponseMessage(message, {
          response:e,
          status:xhr.status,
          statusText:xhr.statusText
        }, 'abort'));
      };

      xhr.send();
    });
  }
}
