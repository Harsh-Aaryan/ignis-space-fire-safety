import * as THREE from "three";
/** Model-sized flame envelope. RGB is illustrative, not thermometry. */
export function flameVolumeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, premultipliedAlpha: true, toneMapped: false, depthWrite: false, depthTest: true, side: THREE.FrontSide,
    uniforms: { uTime: { value: 0 }, uBlue: { value: 0.3 }, uPower: { value: 1 }, uEye: { value: new THREE.Vector3() }, uDome: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `precision highp float;
      varying vec3 vP; uniform vec3 uEye; uniform float uTime,uBlue,uPower,uDome;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 ray=normalize(vP-uEye),p=vP+ray*.002;vec4 color=vec4(0.);
        for(int i=0;i<36;i++){
          if(any(greaterThan(abs(p),vec3(.505))))break;
          float y=p.y+.5;
          float n=noise(p*8.+vec3(0.,-uTime*1.4,0.));
          float n2=noise(p*17.+vec3(uTime*.2,-uTime*2.,0.));
          float radius=mix(.36*(1.-pow(y,.8)),.44*sqrt(max(0.,1.-pow((y-.38)*1.8,2.))),uDome);
          vec2 wobble=vec2(sin(y*8.-uTime*2.),cos(y*11.-uTime*1.4))*.035*y;
          float edge=radius-length(p.xz-wobble)+(n-.5)*.13+(n2-.5)*.05;
          float d=smoothstep(-.06,.05,edge)*smoothstep(0.,.12,y)*(1.-smoothstep(.6,1.,y));
          float shell=1.-smoothstep(.015,.15,edge);
          vec3 warm=mix(vec3(1.,.13,.008),vec3(1.,.72,.14),clamp(edge*5.+(1.-y)*.25,0.,1.));
          vec3 blue=mix(vec3(.06,.15,.6),vec3(.12,.62,1.),shell);
          vec3 emission=mix(warm,blue,uBlue*(.4+.6*shell));
          float alpha=d*.16*clamp(uPower,.3,1.4);
          color.rgb+=(1.-color.a)*emission*alpha*1.6; color.a+=(1.-color.a)*alpha;p+=ray*.035;
        }if(color.a<.005)discard;gl_FragColor=color;
      }`,
  });
}
