export type BrandImageKind='profile'|'logo';

export const PROFILE_IMAGE_REQUIREMENTS='Square: 600×600 to 1000×1000 px, or 1024×1024 px';
export const LOGO_IMAGE_REQUIREMENTS='Square: 600×600 to 1000×1000 px or 1024×1024 px. Landscape: 600–2048 px wide, 300–1000 px high, up to 4:1';

export function imageDimensionError(kind:BrandImageKind,width:number,height:number){
  const requirements=kind==='profile'?PROFILE_IMAGE_REQUIREMENTS:LOGO_IMAGE_REQUIREMENTS;
  const label=kind==='profile'?'Profile photo':'Company logo';
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)
    return `${label} dimensions could not be read. Choose a valid image. ${requirements}.`;
  const actual=`${width}×${height} px`;
  const square=width===height;
  const allowedSquare=square&&((width>=600&&width<=1000)||width===1024);
  const allowedLandscape=kind==='logo'&&width>height&&width>=600&&width<=2048&&height>=300&&height<=1000&&width/height<=4;
  if(allowedSquare||allowedLandscape)return null;
  const reason=width<600||height<(kind==='logo'&&width>height?300:600)?'too small':
    width>(kind==='logo'?2048:1024)||height>1024?'too large':
    kind==='profile'&&!square?'not square':
    kind==='logo'&&width<height?'portrait shaped':
    kind==='logo'&&width/height>4?'too wide':
    'outside the allowed dimensions';
  return `${label} is ${reason} (${actual}). ${requirements}.`;
}
