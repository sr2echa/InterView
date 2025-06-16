<samp>
  
# InterView
Monitor technical interviews in real-time with secure screen sharing and comprehensive system insights. Secure Remote Interview Monitoring. Done Right.

## The plan
Make the client into a npm pkg. So interviewers can just ask them to install the npm pkg like `npm i -g InterView` and run `InterView` to open up the client eliminating the need to "install 3rd party software". Monitoring is via the web to make sure it is easy for the interviewer to monitor

## Bunch of screenshots
Will post a video demo soon

#### Web

<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/8f675e75-dc2b-46ee-838b-332d25c3f86d" width="100%"/></td>
    <td><img src="https://github.com/user-attachments/assets/d5819950-fbed-404e-907c-a76f15fced7d" width="100%"/></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/fa699805-f478-4ad3-91d9-ebe1c71d5dfd" width="100%"/></td>
    <td><img src="https://github.com/user-attachments/assets/6502c7fc-2372-4197-b051-503dac09e94e" width="100%"/></td>
  </tr>
</table>

#### Client

<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/5c7782db-894e-4bbd-bfa9-571fce90c8e9" width="100%"/></td>
    <td><img src="https://github.com/user-attachments/assets/c6e8abc5-0588-4502-831e-62b93428f5a1" width="100%"/></td>
    <td><img src="https://github.com/user-attachments/assets/a6f0d7ed-4e7a-4d16-9aaf-1567fa691f5b" width="100%"/></td>
  </tr>
</table>



## ToDo
- Code Refactoring
- Switch to env for Backend WebSocket URL
- Enhance the Process Page.
    - Add active tabs and known apps running in the background
    - Detect Keystrokes
    - Remote kill processes (with precautions ofc)
- Make the client into npm pkg
- Optimize WebRTC implimentation 

## The Codebase
`client` - Electron APP for interviewee <br>
`server` - websocket server to handle connectins and streaming <br>
`web` - web dashboard in Nextjs + Typescript for the Interviewer to monitor <br>


</samp>
