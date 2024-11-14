# A small tool to signal calls via Action URLs to multiple Tomedo clients

The intention mainly facilitates the signalisation of calls to Tomedo clients if you use DECT phones or multiple SIP accounts or if you want to signal calls on several Tomedo clients.

### snom

We need to use the following 3 triggers in Tomedo:

```
action_incoming_url
action_connected_url
action_disconnected_url
```

For each of this triggers you can pass specific parameters. In order to deal with desk- and DECT-phones alike you need to setup the Action-URL like this

```
http(s)://<ipaddressofthisapp>:<portofthisapp>/<requestUri>?event=<incoming|connected|hangup>&active_user=$active_user&remote=$remote
```

#### Example (simple, one device)

snom:

```
<action_incoming_url perm="">http://192.168.1.10:9090/?event=incoming&active_user=$active_user&remote=$remote</action_incoming_url>
<action_connected_url perm="">http://192.168.1.10:9090/?event=connected&active_user=$active_user&remote=$remote</action_connected_url>
<action_disconnected_url perm="">http://192.168.1.10:9090/?event=hangup&active_user=$active_user&remote=$remote</action_disconnected_url>
```

App:

```json
{
    "setup": [
        {
            "description": "extension a to client 1",
            "requestUri": "",
            "tomedoClients": [
                {"ip": "192.168.1.101", "port": 9090}
            ]
        }
    ],
    "pbxType": "snom",
    "port": 9090
}
```

#### Example (advanced, several devices)

snom:

```
Device A:
<action_incoming_url perm="">http://192.168.1.10:9090/devicea?event=incoming&active_user=$active_user&remote=$remote</action_incoming_url>
<action_connected_url perm="">http://192.168.1.10:9090/devicea?event=connected&active_user=$active_user&remote=$remote</action_connected_url>
<action_disconnected_url perm="">http://192.168.1.10:9090/devicea?event=hangup&active_user=$active_user&remote=$remote</action_disconnected_url>

Device B:
<action_incoming_url perm="">http://192.168.1.10:9090/deviceb?event=incoming&active_user=$active_user&remote=$remote</action_incoming_url>
<action_connected_url perm="">http://192.168.1.10:9090/deviceb?event=connected&active_user=$active_user&remote=$remote</action_connected_url>
<action_disconnected_url perm="">http://192.168.1.10:9090/deviceb?event=hangup&active_user=$active_user&remote=$remote</action_disconnected_url>
```

App:

```json
{
    "setup": [
        {
            "description": "extension a to client 1 & 2",
            "requestUri": "devicea",
            "tomedoClients": [
                {"ip": "192.168.1.101", "port": 9090},
                {"ip": "192.168.1.102", "port": 9090}
            ]
        },
        {
            "description": "extension b to client 3",
            "requestUri": "deviceb",
            "tomedoClients": [
                {"ip": "192.168.1.103", "port": 9090}
            ]
        }
    ],
    "pbxType": "snom",
    "port": 9090
}
```

### Yealink

According to the official documentation both desk- and DECT-phones are capable of Action-URL. We can use the following 4 triggers in Tomedo:

```
incoming_call
call_established
call_terminated
call_remote_canceled
```

For each of this triggers you can pass specific parameters. In order to deal with desk- and DECT-phones alike you need to setup the Action-URL like this

```
http(s)://<ipaddressofthisapp>:<portofthisapp>/<requestUri>?event=<incoming|connected|hangup>&active_user=$active_user&callerID=$callerID
```

#### Example (simple, one device)

Yealink:

```
action_url.incoming_call=http://192.168.1.10:9090/?event=incoming&active_user=$active_user&callerID=$callerID
action_url.call_established=http://192.168.1.10:9090/?event=connected&active_user=$active_user&callerID=$callerID
action_url.call_remote_canceled=http://192.168.1.10:9090/?event=hangup&active_user=$active_user&callerID=$callerID
action_url.call_terminated=http://192.168.1.10:9090/?event=hangup&active_user=$active_user&callerID=$callerID
```

App:

```json
{
    "setup": [
        {
            "description": "extension a to client 1",
            "requestUri": "",
            "tomedoClients": [
                {"ip": "192.168.1.101", "port": 9090}
            ]
        }
    ],
    "pbxType": "yealink",
    "port": 9090
}
```

#### Example (advanced, several devices)

Yealink:

```
Device A:
action_url.incoming_call=http://192.168.1.10:9090/devicea?event=incoming&active_user=$active_user&callerID=$callerID
action_url.call_established=http://192.168.1.10:9090/devicea?event=connected&active_user=$active_user&callerID=$callerID
action_url.call_remote_canceled=http://192.168.1.10:9090/devicea?event=hangup&active_user=$active_user&callerID=$callerID
action_url.call_terminated=http://192.168.1.10:9090/devicea?event=hangup&active_user=$active_user&callerID=$callerID

Device B:
action_url.incoming_call=http://192.168.1.10:9090/deviceb?event=incoming&active_user=$active_user&callerID=$callerID
action_url.call_established=http://192.168.1.10:9090/deviceb?event=connected&active_user=$active_user&callerID=$callerID
action_url.call_remote_canceled=http://192.168.1.10:9090/deviceb?event=hangup&active_user=$active_user&callerID=$callerID
action_url.call_terminated=http://192.168.1.10:9090/deviceb?event=hangup&active_user=$active_user&callerID=$callerID
```

App:

```json
{
    "setup": [
        {
            "description": "extension a to client 1 & 2",
            "requestUri": "devicea",
            "tomedoClients": [
                {"ip": "192.168.1.101", "port": 9090},
                {"ip": "192.168.1.102", "port": 9090}
            ]
        },
        {
            "description": "extension b to client 3",
            "requestUri": "deviceb",
            "tomedoClients": [
                {"ip": "192.168.1.103", "port": 9090}
            ]
        }
    ],
    "pbxType": "yealink",
    "port": 9090
}
```

### macOS: launchd-job

Copy `com.apfelq.node-tomedo-actionurl.plist` to `/Library/LaunchDaemons` and adjust username and paths to your environment. Then load the job with

```
sudo launchctl bootstrap system/ /Library/LaunchDaemons/com.apfelq.node-tomedo-actionurl.plist
```

Confirm any macOS security exceptions. The job should start automatically. If not run

```
sudo launchctl kickstart system/ com.apfelq.node-tomedo-actionurl
```