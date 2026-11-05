// Order-of-magnitude JS sim microbenchmarks (see docs/DESIGN.md §3.6). Run: node bench/microbench.js
function t(name, f, reps=20){ f(); const s=performance.now(); for(let i=0;i<reps;i++) f(); const ms=(performance.now()-s)/reps; console.log(name.padEnd(55), ms.toFixed(3),'ms'); return ms;}
// 1. Tile field logistic growth, 1M hexes
const N=1<<20; const P=new Float32Array(N).fill(10), K=new Float32Array(N); for(let i=0;i<N;i++)K[i]=50+ (i%97);
t('1M tiles logistic growth (Float32Array)', ()=>{ for(let i=0;i<N;i++){ const p=P[i]; P[i]=p+0.01*p*(1-p/K[i]); }});
// 2. 1M movers SoA vs class objects
for (const M of [10000,100000,1000000]) {
 const x=new Float32Array(M),y=new Float32Array(M),vx=new Float32Array(M).fill(1),vy=new Float32Array(M).fill(.5);
 t(`${M} movers SoA update`, ()=>{ for(let i=0;i<M;i++){x[i]+=vx[i]*.1;y[i]+=vy[i]*.1;} });
 class Wagon{constructor(){this.x=0;this.y=0;this.vx=1;this.vy=.5;this.cargo=0;}update(){this.x+=this.vx*.1;this.y+=this.vy*.1;}}
 const arr=[];for(let i=0;i<M;i++)arr.push(new Wagon());
 t(`${M} movers class instances .update()`, ()=>{ for(let i=0;i<M;i++)arr[i].update(); });
 t(`${M} movers class, allocating new obj per tick (GC)`, ()=>{ for(let i=0;i<M;i++){const w=arr[i]; const v={dx:w.vx*.1,dy:w.vy*.1}; w.x+=v.dx; w.y+=v.dy;} });
}
// 3. A* on hex grid W x H (axial, offset storage), long path
const W=1024,H=512; const cost=new Uint8Array(W*H).fill(1); for(let i=0;i<W*H;i++) if(Math.random()<0.2) cost[i]=255; // walls
const g=new Float32Array(W*H), closed=new Uint8Array(W*H);
const dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function hexDist(aq,ar,bq,br){const dq=aq-bq,dr=ar-br;return (Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2;}
function astar(sq,sr,tq,tr){ g.fill(Infinity); closed.fill(0); // binary heap
 const heap=[]; const push=(f,i)=>{heap.push([f,i]);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p][0]<=heap[k][0])break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p;}};
 const pop=()=>{const top=heap[0];const last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){let l=2*k+1,r=l+1,m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return top;};
 const s=sr*W+sq; g[s]=0; push(0,s); let exp=0;
 while(heap.length){const [,i]=pop(); if(closed[i])continue; closed[i]=1; exp++; const q=i%W,r=(i/W)|0; if(q===tq&&r===tr)return exp;
  for(const [dq,dr] of dirs){const nq=q+dq,nr=r+dr; if(nq<0||nr<0||nq>=W||nr>=H)continue; const j=nr*W+nq; if(cost[j]===255||closed[j])continue; const ng=g[i]+cost[j]; if(ng<g[j]){g[j]=ng; push(ng+hexDist(nq,nr,tq,tr),j);} } }
 return exp; }
let e; const ms=t('A* 1024x512 hex, ~300-hex path, 20% walls', ()=>{e=astar(100,100,400,300);},10); console.log('   nodes expanded',e);
// 4. Flow field (Dijkstra-ish BFS) over whole map, one target -> all units share
const dist=new Int32Array(W*H); const q=new Int32Array(W*H);
t('BFS flow field full 1024x512 hex map', ()=>{ dist.fill(-1); let h=0,tl=0; const s=300*W+500; dist[s]=0;q[tl++]=s; while(h<tl){const i=q[h++];const qq=i%W,r=(i/W)|0; for(const [dq,dr] of dirs){const nq=qq+dq,nr=r+dr; if(nq<0||nr<0||nq>=W||nr>=H)continue; const j=nr*W+nq; if(cost[j]===255||dist[j]>=0)continue; dist[j]=dist[i]+1; q[tl++]=j;}} },5);
