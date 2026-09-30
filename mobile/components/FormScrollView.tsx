import {createContext,useCallback,useContext,useEffect,useRef} from 'react';
import {Keyboard,Platform,ScrollView,ScrollViewProps,TextInput} from 'react-native';

const FormFocusContext=createContext<(()=>void)|null>(null);
export function useFormFocus(){return useContext(FormFocusContext)}

/** Keep the active field in view in long forms, including when the keyboard is already open. */
export function FormScrollView({onLayout,onScroll,scrollEventThrottle,children,...props}:ScrollViewProps){
  const scrollRef=useRef<ScrollView>(null);
  const scrollY=useRef(0);
  const keyboardTop=useRef<number|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const revealFocusedField=useCallback(()=>{
    const scroll=scrollRef.current;
    const nativeScroll=scroll?.getNativeScrollRef();
    const input=TextInput.State.currentlyFocusedInput();
    keyboardTop.current=Keyboard.metrics()?.screenY??keyboardTop.current;
    if(!scroll||!nativeScroll||!input||keyboardTop.current===null)return;
    nativeScroll.measureInWindow((_x,viewportTop,_width,viewportHeight)=>{
      input.measureInWindow((_inputX,inputTop,_inputWidth,inputHeight)=>{
        const visibleTop=viewportTop+16;
        const visibleBottom=Math.min(viewportTop+viewportHeight,keyboardTop.current??Infinity)-20;
        if(visibleBottom<=visibleTop)return;
        const inputBottom=inputTop+inputHeight;
        const shift=inputBottom>visibleBottom?inputBottom-visibleBottom:inputTop<visibleTop?inputTop-visibleTop:0;
        if(shift!==0)scroll.scrollTo({y:Math.max(0,scrollY.current+shift),animated:true});
      });
    });
  },[]);

  const scheduleReveal=useCallback((delay=80)=>{
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(revealFocusedField,delay);
  },[revealFocusedField]);

  useEffect(()=>{
    const shown=Keyboard.addListener('keyboardDidShow',event=>{
      keyboardTop.current=event.endCoordinates.screenY;
      scheduleReveal(60);
    });
    const hidden=Keyboard.addListener('keyboardDidHide',()=>{
      keyboardTop.current=null;
      if(timer.current)clearTimeout(timer.current);
    });
    return()=>{
      shown.remove();hidden.remove();
      if(timer.current)clearTimeout(timer.current);
    };
  },[scheduleReveal]);

  return <FormFocusContext.Provider value={scheduleReveal}><ScrollView
    {...props}
    ref={scrollRef}
    automaticallyAdjustKeyboardInsets={Platform.OS==='ios'}
    keyboardShouldPersistTaps={props.keyboardShouldPersistTaps??'handled'}
    keyboardDismissMode={props.keyboardDismissMode??'on-drag'}
    scrollEventThrottle={scrollEventThrottle??16}
    onScroll={event=>{scrollY.current=event.nativeEvent.contentOffset.y;onScroll?.(event)}}
    onLayout={event=>{onLayout?.(event);if(keyboardTop.current!==null)scheduleReveal(40)}}
  >{children}</ScrollView></FormFocusContext.Provider>;
}
