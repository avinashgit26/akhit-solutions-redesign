document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-year]').forEach(n=>n.textContent=String(new Date().getFullYear()));
 const syncViewportControls=()=>{
  const viewport=window.visualViewport;
  const width=viewport?viewport.width:document.documentElement.clientWidth;
  const offset=viewport?viewport.offsetLeft:0;
  document.querySelectorAll('.search-overlay,.menu-overlay').forEach(overlay=>{overlay.style.setProperty('width',`${width}px`,'important');overlay.style.setProperty('max-width',`${width}px`,'important');overlay.style.setProperty('left',`${offset}px`,'important');overlay.style.setProperty('right','auto','important')});
  const panel=document.querySelector('#privacy-policy-panel');
  if(panel){const panelWidth=Math.max(0,Math.min(920,width-36));panel.style.setProperty('position','fixed','important');panel.style.setProperty('top','auto','important');panel.style.setProperty('bottom','18px','important');panel.style.setProperty('width',`${panelWidth}px`,'important');panel.style.setProperty('left',`${offset+(width-panelWidth)/2}px`,'important');panel.style.setProperty('right','auto','important');}
  const back=document.querySelector('.back-to-top');
  if(back){back.style.setProperty('position','fixed','important');back.style.setProperty('top','auto','important');back.style.setProperty('bottom','24px','important');back.style.setProperty('left',`${offset+Math.max(12,width-68)}px`,'important');back.style.setProperty('right','auto','important');}
 };
 syncViewportControls();
 window.visualViewport?.addEventListener('resize',syncViewportControls);
 window.visualViewport?.addEventListener('scroll',syncViewportControls);
 window.addEventListener('resize',syncViewportControls);
 const header=document.querySelector('#header'),toggle=document.querySelector('.nav-toggle'),links=document.querySelectorAll('.primary-links a');
 if(toggle&&header){toggle.addEventListener('click',()=>{const open=header.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close menu':'Open menu')});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.classList.contains('is-open')){header.classList.remove('is-open');toggle.setAttribute('aria-expanded','false')}});links.forEach(a=>a.addEventListener('click',()=>{header.classList.remove('is-open');toggle.setAttribute('aria-expanded','false')}))}
 document.querySelectorAll('.case-studies-filters').forEach(group=>{const buttons=group.querySelectorAll('.isotope-filters button[data-filter]'),grid=group.querySelector('.isotope');if(!grid||!buttons.length)return;buttons.forEach(button=>button.addEventListener('click',()=>{const filter=button.getAttribute('data-filter')||'';group.querySelector('.isotope-filters .active')?.classList.remove('active');button.classList.add('active');grid.querySelectorAll('.grid-item').forEach(item=>{item.classList.toggle('is-hidden',!!filter&&!item.matches(filter))})}))});
});
