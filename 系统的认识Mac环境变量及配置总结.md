## 系统的认识Mac环境变量及配置总结
---
从前在配置任何项目环境时，总是google一下，查查资料，照着别人的解决办法试试。

虽说最终总是能解决，但作为一个开发，没有一种了然于心的感觉总是有些不爽的。

而且作为一种不是日常开发频繁使用的知识，很容易看过之后只留下模糊的印象，所以整理一篇文章作为记录是有必要的。
此处只了解Mac的环境变量配置。



### 关于PATH变量
当我们想运行一个程序时，待运行的程序往往不是当前目录，而PATH变量用于保存可以搜索的目录路径，如果待运行的程序不在当前目录，
操作系统就会依次去搜索`PATH`变量中保存的的目录，当在这些目录中找到目标程序便可以正确执行。

我们可以在命令行中输入
```bash
echo $PATH
```
在我的电脑里得到的是
```bash
/Users/yup/.nvm/versions/node/v8.9.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin
```
整理一下便是
```bash
/Users/yup/.nvm/versions/node/v8.9.0/bin
/usr/bin
/bin
/usr/sbin
/sbin
/usr/local/bin
```
尝试进入第一个目录`/Users/yup/.nvm/versions/node/v8.9.0/bin`
```bash
babel                  node
babel-doctor           npm
babel-external-helpers npx
babel-node
```
会发现这些都是我们在命令行中可以直接运行的程序

所以当我们在命令行中输入程序名并运行程序时，系统会从`$PATH`中遍历并找到对应的程序运行。

那么问题来了，这个`$PATH`变量中的目录是在哪里得到的呢？

### 读取环境变量的位置
---
在Mac OS中，`$PATH`的加载会按顺序从下面几个文件中加载
```bash
/etc/profile
/etc/paths
~/.bash_profile 
~/.bash_login 
~/.profile 
~/.bashrc
```
其中etc为系统级配置，~为用户级配置
etc目录是系统级别的，系统启动就会加载，后三个当中，任意一个存在，系统不会继续往后面读文件
比如`~/.bash_profile`存在，`~/.bash_login`和`~/.profile `便不会读取。

而`~/.bashrc`是个例外，它是在shell启动时读取的。如果你用别的shell，比如zsh
你就会在启动zsh的时候执行`~/.zshrc`。

P.S. 如果你使用了omyzsh,你可以会发现`~/.bash_profile`并不执行，因为它将默认启动脚本改为`～/.zshrc`了。
解决办法是在`～/.zshrc`中添加`source ～/.bash_profile`的命令。

我们尝试看一下`/etc/paths`中的内容，得到
```bash
/usr/bin
/bin
/usr/sbin
/sbin
/usr/local/bin
```
正好对应上了`$PATH`中的一部分，
而`/Users/yup/.nvm/versions/node/v8.9.0/bin`我也在`~/.zshrc`中找到。（建议读者可以在查找一些自己$PATH变量中的内容，加深印象）

相应的，如果我执行`chsh -s /bin/bash`，从zsh改用bash,重新启动命令行，会发现已经找不到`nvm`
```bash
$ nvm
-bash: nvm: command not found
```
因为nvm的环境变量加载是在`~/.zshrc`当中的。

### shell类型
---
使用命令：
```bash
echo $SHELL
```
可以显示当前Mac系统的Shell类型。

### 如何新增环境变量
---
此处我以最常见的Android sdk为例。
我在`~/.bash_profile`中加入以下shell
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```
可以看出来这里改写了`$PATH`变量，在`$PATH`后面通过`:`加入新的目录。
这样就可以加载到Android SDK。

- 临时环境变量
有时候，我们会在调用一个命令之前，临时改变一个环境变量
比如，执行某个node脚本时，会判断环境变量env，此时我们可以这样使用
```
echo 'export env=true'
```
然后再执行脚本
### 定位环境变量
---
实际开发的时候，我们可能会遇到版本不一致的问题。
比如我明明装了node8.9.0，实际脚本运行的时候总是node10.0
这个时候我们可以定位一下node的bin文件位置
```bash
$ which node
/Users/yup/.nvm/versions/node/v8.9.0/bin/node
```
然后进入目录
```bash
cd /Users/yup/.nvm/versions/node/v8.9.0/bin/
$ ls -l
```
通过`ls -l`找到node的引用位置，然后定位问题

此外，如果是自动脚本找不到环境变量，也需要留意一下是否用了正确的shell，是否读取了正确的环境变量


### 总结
系统启动 -> 读取/etc/profile，/etc/paths，~/.bash_profile等文件 -> 加入$PATH变量中

打开命令行 -> 运行对应的shell的rc脚本（例如.zshrc） -> 根据修改$PATH变量 -> 运行程序（比如输入node） -> 遍历$PATH中的路径找到node -> 执行node 
