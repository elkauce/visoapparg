const menu=document.querySelector('.mobile-menu');
const dropdown=document.querySelector('.mobile-dropdown');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');dropdown.hidden=!open;});
dropdown.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{dropdown.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menú');}));
const tabs=[...document.querySelectorAll('[data-space]')];
function select(tab){tabs.forEach(x=>{const active=x===tab;x.setAttribute('aria-selected',String(active));x.tabIndex=active?0:-1;document.querySelector('#space-'+x.dataset.space).hidden=!active;});}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();select(tabs[next]);tabs[next].focus();}});});
const dialog=document.querySelector('#preview-dialog');
document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{dialog.querySelector('.selected-action').textContent=button.dataset.preview;dialog.showModal();}));
dialog.querySelectorAll('.dialog-close,.dialog-continue').forEach(button=>button.addEventListener('click',()=>dialog.close()));
document.querySelectorAll('.mobile-bottom a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.mobile-bottom a').forEach(x=>x.classList.toggle('active',x===a));}));
