import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Page } from './ui';
import { TabBar, type TabKey } from './TabBar';
import { ProfileScreen } from '../screens/ProfileScreen';
import { appPalette as p } from '../theme';
export function FirstUseHome() {
 const [tab,setTab]=useState<TabKey>('today'),[hint,setHint]=useState(false);
 useEffect(()=>{let active=true;void AsyncStorage.getItem('profile-invitation-seen').then(value=>{if(active&&!value)setHint(true);}).catch(()=>{if(active)setHint(true);});return()=>{active=false;};},[]);
 const dismiss=()=>{setHint(false);void AsyncStorage.setItem('profile-invitation-seen','1').catch(()=>{});};
 return <View style={{flex:1,backgroundColor:p.background}}>
  {tab==='profile'?<ProfileScreen/>:<Page tone="dark"><Text style={{color:p.text,fontSize:28,fontWeight:'800'}}>{tab==='today'?'今日':tab==='progress'?'进阶':'数据'}</Text><Text style={{color:p.muted,marginTop:24}}>尚未建立个人档案。</Text><Pressable accessibilityRole="button" onPress={()=>setTab('profile')} style={{paddingVertical:20}}><Text style={{color:p.lime}}>前往我的，建立个人档案</Text></Pressable></Page>}
  <TabBar active={tab} onChange={setTab}/>
  <Modal transparent visible={hint} onRequestClose={dismiss}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:28}}><View style={{backgroundColor:p.raised,padding:24,borderRadius:20}}><Text style={{color:p.text,fontSize:22,fontWeight:'800'}}>请建立个人档案</Text><Text style={{color:p.muted,marginVertical:16}}>可在“我的”页面填写，保存到本机 MEMORY.md。</Text><Pressable accessibilityRole="button" onPress={()=>{dismiss();setTab('profile');}} style={{padding:12}}><Text style={{color:p.lime}}>去填写</Text></Pressable><Pressable accessibilityRole="button" onPress={dismiss} style={{padding:12}}><Text style={{color:p.muted}}>稍后再说</Text></Pressable></View></View></Modal>
 </View>;
}
