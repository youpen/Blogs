### 抓包过滤器规则:
BPF语法(Berkeley Packet Filter)
```
1. 类型Type: host、net、port
2. 方向Dir: src、dest
3. 协议Proto: ether\ip\tcp\udp\http\ftp
4. 逻辑运算符: || && !
```
### 展示过滤器规则: 

1. ip地址过滤案例
```
ip.addr == 192.168.1.1
ip.src == 192.168.1.1
ip.dst === 192.168.1.1
```
2. 端口过滤案例
```
tcp.port == 80
tcp.srcport == 80
tcp.dstport == 80
tcp.flag.syn == 1
```
3. 协议过滤案例
```
arp
tcp
udp
not http
not arp
```
逻辑符: 
```
and
or
not
==
!=
>
>=
<
<= 
```
