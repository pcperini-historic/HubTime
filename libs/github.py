import json

def urlopenauthed(url, username, password):
    import urllib2
    
    passwordManager = urllib2.HTTPPasswordMgrWithDefaultRealm()
    passwordManager.add_password(None, url, username, password)
    
    authHandler = urllib2.HTTPBasicAuthHandler(passwordManager)
    urlOpener = urllib2.build_opener(urllib2.HTTPHandler, authHandler)
    
    return urlOpener.open(url)

GitHubAPIURL = "https://api.github.com"

def user(username, password):
    url = GitHubAPIURL + "/user"
    user = json.load(urlopenauthed(url, username, password))
    return user