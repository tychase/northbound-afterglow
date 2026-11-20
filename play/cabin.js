// Original illustrated vinyl cabin. Normalized wide composition, moving instruments.
const T=Math.PI*2;
function path(c,d,fill,stroke,width=1){const p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p)}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke(p)}}
function lin(c,x,y,X,Y,...colors){const g=c.createLinearGradient(x,y,X,Y);colors.forEach((k,i)=>g.addColorStop(i/(colors.length-1),k));return g}
function label(c,text,x,y,size,color,align='center'){c.font=`${size}px ui-monospace,monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y)}
let interior=null;function build(){let img=document.createElement('canvas');img.width=1700;img.height=330;let c=img.getContext('2d');c.translate(165, -504);
 // The long hood catches one peach band from the sky. Driver's side wiper rests under glass.
 path(c,'M-100 648 Q280 597 700 602 Q1090 600 1480 635 L1520 683 L-120 697Z',lin(c,0,598,8,657,'#a27877','#535464','#353b4b','#262e3c'));
 path(c,'M100 644 Q342 615 438 611 M682 610 Q796 618 890 648',null,'#be949055',1.4);
 path(c,'M240 639 L574 625 M510 642 L579 626 M813 638 L1095 633',null,'#272936',4);
 path(c,'M-280 635 Q93 625 230 624 Q600 625 927 649 Q1230 641 1660 614 L1700 843 L-280 843Z', lin(c,0,616,0,749,'#74666b','#443e48','#423d46','#26252e','#151921'));
 path(c,'M-180 654 Q240 628 521 645 T1060 666 Q1290 656 1580 633',null,'#9c7e7866',2);
 // Dash top defroster slots, double stitched seam, raised instrument binnacle.
 for(let i=0;i<49;i++){let x=748+i*5.5;path(c,`M${x} 649 l16 -3`,null,'#1e232d',2)}
 path(c,'M-125 700 Q32 669 161 671 C241 617 550 616 674 656 Q691 665 699 684 L861 694 L860 733 L-125 765Z',lin(c,0,623,6,716,'#8c7675','#49424b','#272b35','#161a22'),'#292a34',2);
 path(c,'M149 683 Q229 640 377 640 Q606 637 675 676 L666 745 L115 767Z','#191d25','#665b5b',2);
 path(c,'M714 703 Q1103 713 1530 668 L1526 691 Q1139 735 721 723Z',lin(c,0,690,0,725,'#695356','#9c7462','#74544a','#44373b'));
 for(let j=0;j<4;j++)path(c,`M722 ${712+j*2} Q1100 ${721+j*2} 1518 ${675+j*3}`,null,'#c496702b',1);
 // Radio face and factory text; visible outside the player's wheel.
 path(c,'M743 735 L994 735 L985 790 L728 794Z','#20252c','#60585a',2);
 c.fillStyle='#121a20';c.fillRect(785,747,151,23);label(c,'COAST  ·  STEREO',862,762,12,'#d3a778');
 for(const x of [761,960]){c.beginPath();c.ellipse(x,761,12,12,0,0,T);c.fillStyle='#858180';c.fill();c.beginPath();c.arc(x,761,9,0,T);c.fillStyle='#26282e';c.fill();}
 for(let i=0;i<6;i++){c.fillStyle='#4b494c';c.fillRect(791+i*23,777,17,5)}
 label(c,'S E A B R E E Z E',1220,727,12,'#b09a8e');
 for(let j=0;j<9;j++){path(c,`M1054 ${752+j*3.4} L1178 ${745+j*3.4}`,null,j%2?'#6b6260':'#151a21',2)}
 return img;}
const dialFaces=new Map();function dial(c,x,y,r,mx,val,caption){let plate=dialFaces.get(caption);if(!plate){plate=document.createElement('canvas');plate.width=plate.height=4*(r+3);const target=c;c=plate.getContext('2d');c.scale(2,2);c.translate(r+3,r+3);const col='#e6c294';c.beginPath();c.arc(0,0,r,0,T);c.fillStyle='#41424a';c.fill();c.strokeStyle='#a39486';c.lineWidth=1.4;c.stroke();c.beginPath();c.arc(0,0,r-3,0,T);c.fillStyle=lin(c,0,-r,4,r,'#151b23','#30323a','#20232a');c.fill();for(let i=0;i<=30;i++){let a=(.78+1.43*i/30)*Math.PI,co=Math.cos(a),sn=Math.sin(a);c.strokeStyle=i%5?'#918477':col;c.lineWidth=i%5?1:2;c.beginPath();c.moveTo(co*(r-5),sn*(r-5));c.lineTo(co*(r-(i%5?8:12)),sn*(r-(i%5?8:12)));c.stroke();if(i%5===0)label(c,Math.round(mx*i/30),co*(r-20),sn*(r-20)+3,9,col)}label(c,caption,0,r*.42,9,col);dialFaces.set(caption,plate);c=target}c.save();c.translate(x,y);c.drawImage(plate,-r-3,-r-3,2*r+6,2*r+6);const a=(.78+1.43*Math.min(1,val/mx))*Math.PI;c.rotate(a);path(c,`M-8 -2 L${r-9} -.6 L3 2.5Z`,'#fb986b');c.beginPath();c.arc(0,0,3.5,0,T);c.fillStyle='#a6978a';c.fill();c.restore()}
export function drawCabin(c,P,s){const {w,h}=P; const dx=-460*s.look;const dy=125*s.look; c.save();c.scale(w/1400,h/800);
 // Slim windshield trim on driver side, passenger pillar comes into view on head turn.
 c.save();c.translate(dx,dy);path(c,'M-43 -130 L-9 -134 L139 647 L77 655Z',lin(c,0,0,95,0,'#161922','#302e38','#68606a','#211f29'));
 path(c,'M1458 -165 L1493 -153 L1303 655 L1258 656Z',lin(c,1251,0,1329,0,'#282a33','#8b7575','#514751','#23232d'));
 if(s.look>.05){path(c,'M1260 651 Q1429 597 1634 593 L1980 635 L1945 827 L1254 820Z',lin(c,0,590,0,735,'#9a7e79','#514551','#242731','#1b1f29'));path(c,'M1326 635 Q1413 587 1526 595 L1550 623 L1442 631Z','#262b35','#77696d',2)}
 if(!interior)interior=build();c.drawImage(interior,-165,504);dial(c,377,710,60,120,s.speed*2.237,'MPH');dial(c,507,700,45,6,1.05+s.speed*.095,'RPM × 1K');dial(c,262,711,35,100,68,'FUEL');
 // Steering wheel is soft black leather, not a circular overlay on the windscreen.
 c.translate(391,840);c.rotate(s.steer*.27);const ring=new Path2D();ring.ellipse(0,0,201,157,0,0,T);c.strokeStyle='#141820';c.lineWidth=26;c.stroke(ring);c.strokeStyle=lin(c,0,-160,0,130,'#75646a','#423d47','#20242d');c.lineWidth=17;c.stroke(ring);c.setLineDash([3,6]);c.lineWidth=1;c.strokeStyle='#ab928073';c.stroke(ring);c.setLineDash([]);path(c,'M-189 -25 Q-133 -15 -80 -29 L73 -35 Q133 -26 186 -49 L191 -30 Q131 -6 75 7 L62 55 L-67 62 L-85 14 L-189 -7Z','#373741','#706361',2);c.restore();c.restore();}
