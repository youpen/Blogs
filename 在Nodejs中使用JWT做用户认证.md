前后端分离后，后端只承担api的功能，传统的使用session的认证方法带来很大的不便：例如移动端app和PC端不能共用cookie等。

下面实例在node中用JWT做用户认证
首先我们使用JWT simple这个库区处理JWT的加密问题
```
npm install --save jwt-simple
```
```
var express = require('express');
var jwt = require('jwt-simple');
var app = express();
//设置密钥
app.set('jwtTokenSecret', 'YOUR_SCRET_STRING');
```
首先第一件事是让客户端通过账号密码交换token，可以使用post，此处假设已经得到了用户名和密码。
  
#####制造token
验证用户名和密码通过后，返回一个包含JWT的响应。
```
var expires = moment().add('days', 7).valueOf()；
var token = jwt.encode({
        iss: user.id,
        exp: expires,
    }, app.get('jwtTokenSecret));

res.json({
        token: token,
        expires: expires,
        user: user.toJSON()
    })
```
#####检验token
为了验证JWT，我们需要写出一些可以完成这些功能的中间件：
- 检查附上的token
- 解密
- 验证token的可用性
- 如果token是合法的，检索里面的用户，以及附加到请求的对象上。

我们来写一个中间件的框架
```
var UserModel = require('../models/user');
var jwt = require('jwt-simple');

module.exports = function(req, res, next) {
  //todo
}
```
为了获得最大的可拓展性，我们允许客户端使用三个方法附加我们的token： 
1. 作为请求链接的参数（query）
2. 作为主体的参数（body）
3. 作为请求头的参数（Header）（使用x-access-token）

下面是试图检索token的代码
```
var token = (req.body && req.body.access_token) || (req.query && req.query.access_token) || req.header['x-access-token']
```
注意访问req.body首先需要引入express.bodyParser()中间件

#####解析token
获得token后，开始解析
```
 if (token) {
        try {
            var decoded = jwt.decode(token, app.get('jwtTokenSecret'));
            //todo  handle token here
        } catch (err) {
            return next()
        }
    } else {
        next()
    }
```
如果解析失败，我们使用next跳过路由，这代表我们无法确定用户合法性。
如果解析成功，我们获得两个属性， ```iss```包含用户ID，```exp```包含过期时间。我们先处理后者，如果它过期了，直接拒绝。
```
if( decoded.exp <= Date.now()) {
  res.end('Access token has expired', 400)
}
```
如果token合法，我们可以从中检索出用户信息，并且附加到请求对象上面去：
```
User.findOne({ _id: decoded.iss }, function(err, user) {
  req.user = user;
})
```

最后将这个中间件附加到路由里面：
```
var jwtauth = require('./jwtauth.js')
app.get('/something', [express.bodyParser(), jwtauth], function(req, res){
  //do something
})
```
或者匹配一些路由
```
app.all('/api/*',[express.bodyParser(), jwtauth])
```

####客户端部分
客户端再第一次获得token后，可以存储在localStorage中，请求的时候发出token
```
var token = window.localStorage.getItem('token');

if (token) {
  $.ajaxSetup({
    headers: {
      'x-access-token': token
    }
  });
}
```
