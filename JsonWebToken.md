JWT(JSON WEB TOKEN)是一个轻量级的规范，用于允许客户端与服务器之间较为安全的传递信息。

> 注意：JWT通过类似于自加密证书的原理保证数据无法被篡改，即该信息可能被窃取，只是不能被修改，所以只应传递非敏感信息。用户名、密码之类的信息不应该通过JWT传递。

本质上JWT就是一个字符串。该字符串分为三部分，用“.”隔开
例如：
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmcm9tX3VzZXIiOiJCIiwidGFyZ2V0X3VzZXIiOiJBIn0.rSWamyAYwuHCo7IFAgd1oRpSP7nzL7BF5t7ItqpKViM
```
分别为Header、Payload、Signature

#####头部（Header）：
用于描述JWT的基本信息，例如类型和签名所用算法，可以用一个JSON对象表示：
```
{
  "typ": "JWT",
  "alg": "HS256"
}
```
对其采用base64编码，之后的字符串即JWT的头部
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9
```

#####载荷（Payload）
```
{
    "iss": "John Wu JWT",
    "iat": 1441593502,
    "exp": 1441594722,
    "aud": "www.example.com",
    "sub": "JWT@example.com",
    "from_user": "B",
    "target_user": "A"
}
```
前五个字段有JWT规范所定义：
- ```iss``` : 该JWT的签发者
- ```sub``` : 该JWT的面向的用户
- ```aud``` ：该JWT的接收者
- ```exp```(expire) : 过期时间
- ```iat``` (issue at) : 在什么时候签发的

将该JSON进行base64转码，获得以下字符串
```
eyJmcm9tX3VzZXIiOiJCIiwidGFyZ2V0X3VzZXIiOiJBIn0
```

##### 签名（签名）
将上面的两个编码后的字符串用句号 ```.```拼接起来得到
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmcm9tX3VzZXIiOiJCIiwidGFyZ2V0X3VzZXIiOiJBIn0
```
此时再用Header中指定的算法HS256进行加密，加密时还需要提供一个密钥（secret）。如果用```mystar```作为密钥，得到的内容为
```
rSWamyAYwuHCo7IFAgd1oRpSP7nzL7BF5t7ItqpKViM
```
将三部分的内容拼接起来则可以得到文章开头的JWT

该JWT的Header和Payload采用base64编码，任何人都可以得到明文。
但是如果通过修改明文，没有正确的密钥，签名部分是不会正确的。
自加密证书原理可以参考```https://www.zhihu.com/question/24294477```

---
#####使用场景
让我们来假想一下一个场景。在A用户关注了B用户的时候，系统发邮件给B用户，并且附有一个链接“点此关注A用户”。链接的地址可以是这样的
```
https://your.awesome-app.com/make-friend/?from_user=B&target_user=A
```
上面的URL主要通过URL来描述这个当然这样做有一个弊端，那就是要求用户B用户是一定要先登录的。可不可以简化这个流程，让B用户不用登录就可以完成这个操作。JWT就允许我们做到这点。

服务端发送了一个JWT
```
https://your.awesome-app.com/make-friend/?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmcm9tX3VzZXIiOiJCIiwidGFyZ2V0X3VzZXIiOiJBIn0.rSWamyAYwuHCo7IFAgd1oRpSP7nzL7BF5t7ItqpKViM
```
客户端点击该链接后，服务端按照流程对该服务操作
1. 加密Header和Payload，看看是否和Signature一致。检验通过后，为用户B添加A好友。
如果有人想篡改，他将Header和Payload解码，并将该链接的效果改为添加C为好友，服务器在检验过程就会发现不对，拒绝这个Token，返回一个HTTP 401 Unauthorized响应。
这保证了这个token只能执行指定操作。
如果像一开始那个链接，用户就必须先进行一次用户验证，服务器才能允许该操作。如果不进行用户验证，可以进行任何信息篡改执行别的操作。

本文参考```http://blog.leapoahead.com/2015/09/06/understanding-jwt/```，并加以自己的理解。


