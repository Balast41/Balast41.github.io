// Génération des étoiles
const midEl = document.getElementById('layer-mid');
for(let i = 0; i < 45; i++){
  const s = document.createElement('img');
  s.src = 'img/star.svg';
  const sz = Math.random() * 12 + 6;
  s.style.cssText = `
    position: absolute;
    width: ${sz}px;
    height: ${sz}px;
    top: ${Math.random()*100}%;
    left: ${Math.random()*100}%;
    opacity: ${0.4 + Math.random()*0.5};
    animation: twinkle ${1.5+Math.random()*3}s ease-in-out infinite ${-Math.random()*4}s;
    --max-op: ${0.4+Math.random()*0.6};
    filter: drop-shadow(0 0 3px white);
  `;
  midEl.appendChild(s);
}

const closeEl = document.getElementById('layer-close');
for(let i = 0; i < 45; i++){
  const s = document.createElement('img');
  s.src = 'img/star.svg';
  const sz = Math.random() * 12 + 6;
  s.style.cssText = `
    position: absolute;
    width: ${sz}px;
    height: ${sz}px;
    top: ${Math.random()*100}%;
    left: ${Math.random()*100}%;
    opacity: ${0.4 + Math.random()*0.5};
    animation: twinkle ${1.5+Math.random()*3}s ease-in-out infinite ${-Math.random()*4}s;
    --max-op: ${0.4+Math.random()*0.6};
    filter: drop-shadow(0 0 3px white);
  `;
  midEl.appendChild(s);
}
