var B={show:!1,help:"",baseUrls:void 0,baseUrlLabel:"API Base URL",apiKeyLabel:"API Key",buttonLabel:"Save & Test",storage:localStorage},P=a=>async(r={})=>{let t={...B,...a,...r},e;try{e=JSON.parse(t.storage.getItem(t.key)||"null")}catch{}if(e&&!t.show){let o=await t.fetchModels?.(e.baseUrl,e.apiKey);return{...e,baseURL:e.baseUrl,models:o}}return await q(e,t)},C=P({key:"bootstrapLLMProvider_openaiConfig",defaultBaseUrls:["https://api.openai.com/v1"],title:"OpenAI API Configuration",fetchModels:R});async function R(a,r){if(!/^https?:\/\//.test(a))throw new Error("Invalid URL");let t=r?{Authorization:`Bearer ${r}`}:{},e=await fetch(a.replace(/\/$/,"")+"/models",{headers:t});if(!e.ok)throw new Error("Invalid API key or URL");let{data:o}=await e.json();if(!o||!Array.isArray(o))throw new Error("Invalid response");return o.map(i=>typeof i=="string"?i:i.id||"").filter(Boolean)}function q(a,{help:r,baseUrls:t,defaultBaseUrls:e,title:o,baseUrlLabel:i,apiKeyLabel:U,buttonLabel:g,storage:L,key:$,fetchModels:I}){return new Promise((k,u)=>{h();let y="llm-provider-modal",v=a?.baseUrl||t?.[0]?.url||e[0],E=a?.apiKey||"",S=e.map(l=>`<option value="${l}">`).join(""),A=(t||[]).map(({url:l,name:s})=>`<option value="${l}" ${l===v?"selected":""}>${s}</option>`).join(""),K=t?`<select name="baseUrl" class="form-select">${A}</select>`:`<input name="baseUrl" type="url" class="form-control" list="llm-provider-dl" placeholder="https://api.openai.com/v1" value="${v}"><datalist id="llm-provider-dl">${S}</datalist>`;document.body.insertAdjacentHTML("beforeend",`
<div class="modal fade show" id="${y}" tabindex="-1" style="display:block;background:rgba(0,0,0,.4);z-index:1050;">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content shadow-sm">
      <div class="modal-header">
        <h5 class="modal-title">${o}</h5>
        <button type="button" class="btn-close" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        ${r||""}
        <div class="mb-3">
          <label class="form-label">${i}</label>
          ${K}
        </div>
        <div class="mb-3">
          <label class="form-label">${U}</label>
          <input name="apiKey" type="password" class="form-control" autocomplete="off" value="${E}">
        </div>
        <div class="text-danger small" style="display:none"></div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-primary w-100">${g}</button>
      </div>
    </form>
  </div>
</div>`);let d=document.getElementById(y),n=d.querySelector("form"),x=d.querySelector(".btn-close"),c=d.querySelector(".text-danger"),m=()=>{h(),window.removeEventListener("keydown",f)};function f(l){l.key==="Escape"&&(m(),u(new Error("cancelled")))}x.onclick=()=>{m(),u(new Error("cancelled"))},window.addEventListener("keydown",f),n.onsubmit=async l=>{l.preventDefault(),c.style.display="none";let s=n.baseUrl.value.trim(),b=n.apiKey.value.trim();if(!/^https?:\/\//.test(s))return w("Enter a valid URL");n.querySelector("button[type=submit]").disabled=!0;try{let p=await I(s,b);L.setItem($,JSON.stringify({baseUrl:s,apiKey:b})),m(),k({baseUrl:s,baseURL:s,apiKey:b,models:p})}catch(p){w(p.message),n.querySelector("button[type=submit]").disabled=!1}};function w(l){c.textContent=l,c.style.display=""}})}function h(){let a=document.getElementById("llm-provider-modal");a&&a.remove()}export{C as openaiConfig};
