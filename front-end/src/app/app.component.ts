import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatMessage, PeerData, SignalInfo, UserInfo } from './models/peerData';
import { SignalrService } from './signalr.service';
import { RtcService } from './rtc.service';
import { UserListComponent } from './user-list/user-list.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-root',
  imports: [UserListComponent, FormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'ChatRoomApp';
  @ViewChild('videoPlayer') videoPlayer!: ElementRef;

  public subscriptions = new Subscription();

  private stream : any;

  public currentUser!: string ;

  public dataString: string = "";

  public userVideo!: string;

  public messages: Array<ChatMessage> = new Array();

  public mediaError = (): void => { console.error(`Can't get user media`); };

  constructor(private rtcService: RtcService, private signalR: SignalrService) { }

  ngOnInit() {
    this.messages = new Array();

    this.subscriptions.add(this.signalR.newPeer$.subscribe((user: UserInfo) => {
      this.rtcService.newUser(user);
      this.signalR.sayHello(this.currentUser, user.connectionId);
    }));

    this.subscriptions.add(this.signalR.helloAnswer$.subscribe((user: UserInfo) => {
      this.rtcService.newUser(user);
    }));

    this.subscriptions.add(this.signalR.disconnectedPeer$.subscribe((user: UserInfo) => {
      this.rtcService.disconnectedUser(user);
    }));

    this.subscriptions.add(this.signalR.signal$.subscribe((signalData: SignalInfo) => {
      this.rtcService.signalPeer(signalData.user, signalData.signal, this.stream);
    }));

    this.subscriptions.add(this.rtcService.onSignalToSend$.subscribe((data: PeerData) => {
      this.signalR.sendSignalToUser(data.data, data.id);
    }));

    this.subscriptions.add(this.rtcService.onData$.subscribe((data: PeerData) => {
      this.messages = [...this.messages, { own: false, message: data.data }];
      console.log(`Data from user ${data.id}: ${data.data}`);
    }));

    this.subscriptions.add(this.rtcService.onStream$.subscribe((data: PeerData) => {
      this.userVideo = data.id;
      this.videoPlayer.nativeElement.srcObject = data.data;
      this.videoPlayer.nativeElement.load();
      this.videoPlayer.nativeElement.play();
      console.log(`stream`,data);
      
    }));
  }


  public onUserSelected(userInfo: UserInfo) {
    const peer = this.rtcService.createPeer(this.stream, userInfo.connectionId, true);
    this.rtcService.currentPeer = peer;
    console.log(`video`,this.videoPlayer.nativeElement.srcObject);
  }

  public async saveUsername(): Promise<void> {
    try {
      await this.signalR.startConnection(this.currentUser);
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (error) {
      console.error(`Can't join room, error ${error}`);
    }
  }

  public sendMessage() {
    this.rtcService.sendMessage(this.dataString);
    this.messages = [...this.messages, { own: true, message: this.dataString }];
    console.log(`Data sent:`,this.messages);
    console.log(`Data from user`,this.rtcService.onData$);
    this.dataString = "";
  }
  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

}

