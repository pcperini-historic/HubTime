function controller()
{
    // Static Variables
    self = this;
    
    // Static Functions
    function parseContent(body, info)
    {
        var content = body.replace(info, "");
        content = $.trim(content);
        
        content = content.split(/[\.!?]/)[0];
        return content + '...';
    }
    
    function parseDate(dateString)
    {
        dateString = dateString.split("T")[0];
        var dateParts = dateString.split("-");
        return dateParts[1] + "/" + dateParts[2] + "/" + dateParts[0];
    }
    
    // Constants
    var controllerDateFormatRegex = /^[0-9]{1,2}\/[0-9]{1,2}(\/[0-9]{2,4})?$/g;
    var controllerHoursFormatRegex = /^[0-9]+$/g;
    var controllerRecordFormatRegex = /\`([0-9]+)h`(.*)/g;
    
    var controllerUsernameCookie = "hubtime.username";
    var controllerPasswordCookie = "hubtime.password";
    
    var controllerWelcomeMessage = "Welcome back, ";
    
    // Initializers
    self.init = function()
    {    
        // Models
        self.user = null;
        self.currentRepo = null;
        self.githubConnection = null;
    
        // Views
        self.signInOverlay = $("#sign-in-overlay");
        self.signInContainer = $("#sign-in-container");
        self.usernameInput = $("#username-input");
        self.passwordInput = $("#password-input");
        self.signInButton = $("#sign-in-button");
        
        self.userInfoContainer = $("#user-info-container");
        self.userAvatar = $("#user-avatar");
        self.welcomeMessage = $("#welcome-message");
        self.projectSelector = $("#project-selector");
        self.refreshButton = $("#refresh-button");
        self.logoutButton = $("#logout-button");
        
        self.activityIndicator = $("#activity-indicator");
        self.recordsTable = $("#records-table");
        
        self.newRecordDate = $("#new-record-date");
        self.newRecordTaskSelector = $("#new-record-task-selector");
        self.newRecordHoursInput = $("#new-record-hours-input");
        self.newRecordCommentInput = $("#new-record-comment-input");
        self.newRecordAddButton = $("#new-record-add-button");
        self.recordRemoveButtons = $(".record-remove-button");
    
        // Responders
        self.signInButton.click(self.signInButtonWasPressed);
        self.projectSelector.change(self.projectSelectorSelectionDidChange);
        self.refreshButton.click(self.refreshButtonWasPressed);
        self.logoutButton.click(self.logoutButtonWasPressed);
        self.newRecordHoursInput.keyup(self.newRecordHoursInputTextDidChange);
        self.newRecordAddButton.click(self.newRecordAddButtonWasPressed);
        
        // Initial State
        var hasCredentialsCookies = true;
        hasCredentialsCookies &= Boolean($.cookie(controllerUsernameCookie));
        hasCredentialsCookies &= Boolean($.cookie(controllerPasswordCookie));
        
        if (hasCredentialsCookies)
        {
            self.updateUser($.cookie(controllerUsernameCookie), $.cookie(controllerPasswordCookie));
        }
        
        self.activityIndicator.showCount = 0;
        self.recordsTable.tablesorter();
    }
    
    // Updaters
    self.updateUser = function(username, password)
    {        
        var userRequestData = {
            'method': 'GET',
            'target': 'user',
            'username': username,
            'password': password
        };
    
        self.startActivityIndicator();
        var userRequest = $.get('', userRequestData);
        userRequest.success(function(user)
        {
            self.user = user;
            self.user.password = password;
            
            $.cookie(controllerUsernameCookie, username);
            $.cookie(controllerPasswordCookie, password);
            
            self.usernameInput.parent().removeClass("error");
            self.passwordInput.parent().removeClass("error");
            self.signInOverlay.hide();
            self.signInContainer.hide();
            
            self.userInfoContainer.show();
            
            self.userAvatar.attr("src", self.user.avatar_url);
            
            var firstName = self.user.name.split(" ")[0];
            self.welcomeMessage.text(controllerWelcomeMessage + firstName);
            
            var reposRequestData = {
                'method': 'GET',
                'target': 'repos',
                'username': username,
                'password': password
            };
            
            var reposRequest = $.get('', reposRequestData);
            reposRequest.success(function(repos)
            {                
                for (var repoIndex in repos)
                {
                    var repo = repos[repoIndex];
                
                    var projectOption = $("<option/>");
                    projectOption.text(repo.name);
                    
                    self.projectSelector.append(projectOption);
                }
                
                self.stopActivityIndicator();
                self.updateRecordsTable();
            });
            reposRequest.error(function(request, status, error)
            {
                console.log(error);
                self.stopActivityIndicator();
            });
        });
        userRequest.error(function(request, status, error)
        {
            console.log(error);
            self.stopActivityIndicator();
                
            self.usernameInput.parent().addClass("error");
            self.passwordInput.parent().addClass("error");
        });
    }
    
    self.updateRecordsTable = function()
    {
        self.startActivityIndicator();
    
        // Remove Old Data
        var records = self.recordsTable.find("tr");
        $.each(records, function(recordIndex, record)
        {
            record = $(record);
            if (record.hasClass("record"))
            {
                record.remove();
            }
        });
    
        self.newRecordDate.text(parseDate(new Date().toISOString()));
        self.newRecordTaskSelector.empty();
        self.newRecordHoursInput.val("");
        self.newRecordCommentInput.val("");
            
        // Add New Data
        var repoName = $("#project-selector option:selected").text();
        self.currentRepo = repoName;
        if (self.currentRepo == '')
        {
            self.stopActivityIndicator();
            return;
        }
        
        var milestonesRequestData = {
            'method': 'GET',
            'target': 'milestones',
            'username': self.user.login,
            'password': self.user.password,
            'repo': self.currentRepo
        };
        
        // Add Milestones to Task Selector
        var milestonesRequest = $.get('', milestonesRequestData);
        milestonesRequest.success(function(milestones)
        {
            var remainingNumberOfMilestones = milestones.length;
            if (remainingNumberOfMilestones == 0)
                self.stopActivityIndicator();
            
            for (var milestoneIndex in milestones)
            {
                var milestone = milestones[milestoneIndex];
                
                var optionGroup = $("<optgroup/>");
                optionGroup.attr("label", milestone.title);
                optionGroup.attr("number", milestone.number);
                
                self.newRecordTaskSelector.append(optionGroup);
                
                var issuesRequestData = {
                    'method': 'GET',
                    'target': 'issues',
                    'username': self.user.login,
                    'password': self.user.password,
                    'repo': self.currentRepo,
                    'milestone': milestone.number
                };
                
                // Add Issues to Task Selector
                var issuesRequest = $.get('', issuesRequestData);
                issuesRequest.success(function(issues)
                {
                    var remainingNumberOfIssues = issues.length;
                    if (remainingNumberOfIssues == 0)
                        remainingNumberOfMilestones--;
                    if (remainingNumberOfMilestones == 0)
                        self.stopActivityIndicator();
                    
                    for (var issueIndex in issues)
                    {
                        var issue = issues[issueIndex];
                        var optionGroup = $("#new-record-task-selector optgroup[number='" + issue.milestone_number + "']");
                        
                        var option = $("<option/>");
                        option.text(issue.title);
                        option.attr("number", issue.number);
                        
                        optionGroup.append(option);
                        
                        var commentsRequestData = {
                            'method': 'GET',
                            'target': 'comments',
                            'username': self.user.login,
                            'password': self.user.password,
                            'repo': self.currentRepo,
                            'issue': issue.number
                        };
                        
                        var commentsRequest = $.get('', commentsRequestData)
                        commentsRequest.success(function(commentsResponse)
                        {
                            var comments = commentsResponse.comments;
                            var issue = commentsResponse.issue;
                            
                            var recordsTableBody = self.recordsTable.children("tbody");
                            var recordsForSorting = [];
                            
                            for (var commentIndex in comments)
                            {
                                var comment = comments[commentIndex];
                                controllerRecordFormatRegex.compile(controllerRecordFormatRegex);
                                
                                if (controllerRecordFormatRegex.test(comment.body))
                                {
                                    controllerRecordFormatRegex.compile(controllerRecordFormatRegex);
                                    matches = controllerRecordFormatRegex.exec(comment.body);
                                    
                                    comment.hours = matches[1];
                                    comment.comment = parseContent(comment.body, matches[0]);
                                    
                                    var recordTableEntry = $("<tr/>");
                                    recordTableEntry.addClass("record");
                                    recordTableEntry.attr("number", comment.id);
                                    
                                    var recordTableEntryDate = $("<td/>");
                                    recordTableEntryDate.text(parseDate(comment.date));
                                    recordTableEntry.append(recordTableEntryDate);
                                    
                                    var recordTableEntryTask = $("<td/>");
                                    var recordTableEntryTaskLink = $("<a/>");
                                    recordTableEntryTaskLink.text(issue.title);
                                    recordTableEntryTaskLink.attr("href", issue.html_url);
                                    recordTableEntryTaskLink.attr("target", "_blank");
                                    recordTableEntryTask.append(recordTableEntryTaskLink);
                                    recordTableEntry.append(recordTableEntryTask);
                                    
                                    var recordTableEntryHours = $("<td/>");
                                    recordTableEntryHours.text(comment.hours);
                                    recordTableEntry.append(recordTableEntryHours);
                                    
                                    var recordTableEntryComment = $("<td/>");
                                    var recordTableEntryCommentLink = $("<a/>");
                                    recordTableEntryCommentLink.text(comment.comment);
                                    recordTableEntryCommentLink.attr("href", comment.url);
                                    recordTableEntryCommentLink.attr("target", "_blank");
                                    recordTableEntryComment.append(recordTableEntryCommentLink);
                                    recordTableEntry.append(recordTableEntryComment);
                                    
                                    var recordTableEntryControl = $("<td/>");
                                    var recordTableEntryControlRemoveButton = $("<button/>");
                                    recordTableEntryControlRemoveButton.attr("comment-number", comment.id);
                                    recordTableEntryControlRemoveButton.attr("title", "Remove record");
                                    recordTableEntryControlRemoveButton.addClass("btn");
                                    recordTableEntryControlRemoveButton.addClass("btn-small");
                                    recordTableEntryControlRemoveButton.addClass("btn-danger");
                                    var recordTableEntryControlRemoveButtonImage = $("<i/>");
                                    recordTableEntryControlRemoveButtonImage.addClass('icon-remove');
                                    recordTableEntryControlRemoveButtonImage.addClass('icon-white');
                                    recordTableEntryControlRemoveButtonImage.attr("comment-number", comment.id);
                                    recordTableEntryControlRemoveButton.append(recordTableEntryControlRemoveButtonImage);
                                    recordTableEntryControlRemoveButton.click(self.removeRecordButtonWasPressed);
                                    recordTableEntryControl.append(recordTableEntryControlRemoveButton);
                                    recordTableEntry.append(recordTableEntryControl);
                                    
                                    recordsTableBody.append(recordTableEntry);
                                    self.recordsTable.trigger("update");
                                }
                            }
                            
                            remainingNumberOfIssues--;
                            if (remainingNumberOfIssues == 0)
                                remainingNumberOfMilestones--;
                            if (remainingNumberOfMilestones == 0)
                                self.stopActivityIndicator();
                        });
                        commentsRequest.error(function(request, status, error)
                        {
                            console.log(error);
                            
                            remainingNumberOfIssues--;
                            if (remainingNumberOfIssues == 0)
                                remainingNumberOfMilestones--;
                            if (remainingNumberOfMilestones == 0)
                                self.stopActivityIndicator();
                        });
                    }
                });
                issuesRequest.error(function(request, status, error)
                {
                    console.log(error);
                });
            }
        });
        milestonesRequest.error(function(request, status, error)
        {
            console.log(error);
        });
    }
    
    self.updateNewRecordAddButton = function()
    {
        var buttonEnabled = true;
        buttonEnabled &= Boolean(self.newRecordTaskSelector.val());
        buttonEnabled &= !self.newRecordHoursInput.parent().hasClass("error");
        buttonEnabled &= Boolean(self.newRecordHoursInput.val());
        
        if (buttonEnabled)
        {
            self.newRecordAddButton.removeAttr("disabled");
        }
        else
        {
            self.newRecordAddButton.attr("disabled", true);
        }
    }
    
    // Responders
    self.signInButtonWasPressed = function(event)
    {        
        var username = self.usernameInput.val();
        var password = self.passwordInput.val();
        
        self.updateUser(username, password);
    }
    
    self.projectSelectorSelectionDidChange = function(event)
    {
        self.updateRecordsTable();
    }
    
    self.refreshButtonWasPressed = function(event)
    {
        self.updateRecordsTable();
    }
    
    self.logoutButtonWasPressed = function(event)
    {
        $.removeCookie(controllerUsernameCookie);
        $.removeCookie(controllerPasswordCookie);
        location.reload();
    }
    
    self.newRecordHoursInputTextDidChange = function(event)
    {
        controllerHoursFormatRegex.compile(controllerHoursFormatRegex);
        var newRecordHoursString = self.newRecordHoursInput.val();
        
        if (controllerHoursFormatRegex.test(newRecordHoursString))
        {
            self.newRecordHoursInput.parent().removeClass("error");
        }
        else
        {
            self.newRecordHoursInput.parent().addClass("error");
        }
        
        self.updateNewRecordAddButton();
    }
    
    self.newRecordAddButtonWasPressed = function(event)
    {
        var newRecordIssueNumber = self.newRecordTaskSelector.find("option:selected").attr("number");
        var newRecordHours = self.newRecordHoursInput.val();
        var newRecordComments = self.newRecordCommentInput.val();
        
        var recordString = "`"+ newRecordHours + "h`\n\n" + newRecordComments;
        var newRecordRequestData = {
            'method': 'ADD',
            'target': 'comments',
            'username': self.user.login,
            'password': self.user.password,
            'repo': self.currentRepo,
            'issue': newRecordIssueNumber,
            'body': recordString
        };
        
        self.startActivityIndicator();
        var newRecordRequest = $.get('', newRecordRequestData);
        newRecordRequest.success(function()
        {
            self.stopActivityIndicator();
            self.updateRecordsTable();
        });
        newRecordRequest.error(function(request, status, error)
        {
            console.log(error);
            self.stopActivityIndicator();
            self.updateRecordsTable();
        });
    }
    
    self.removeRecordButtonWasPressed = function(event)
    {
        var removeRecordButton = $(event.target);
        var recordCommentNumber = removeRecordButton.attr("comment-number");
        var removeRecordRequestData = {
            'method': 'DEL',
            'target': 'comments',
            'username': self.user.login,
            'password': self.user.password,
            'repo': self.currentRepo,
            'comment': recordCommentNumber
        };
        
        self.startActivityIndicator();
        var removeRecordRequest = $.get('', removeRecordRequestData);
        removeRecordRequest.success(function()
        {
            self.stopActivityIndicator();
            self.updateRecordsTable();
        });
        removeRecordRequest.error(function(request, status, error)
        {
            console.log(error);
            self.stopActivityIndicator();
            self.updateRecordsTable();
        });
    }
    
    // Controllers
    self.startActivityIndicator = function()
    {
        self.projectSelector.attr("disabled", true);
        self.refreshButton.attr("disabled", true);
        self.newRecordTaskSelector.attr("disabled", true);
        self.newRecordAddButton.attr("disabled", true);
        self.recordRemoveButtons.attr("disabled", true);
    
        self.activityIndicator.show();
        setInterval(function()
        {
            if (self.activityIndicator.css("display") == "none")
                return;

            var activityIndicatorText = self.activityIndicator.html();
            if (activityIndicatorText == ". . .")
            {
                self.activityIndicator.html("&nbsp; &nbsp; &nbsp;");
            }
            else if (activityIndicatorText == ". . &nbsp;")
            {
                self.activityIndicator.html(". . .");
            }
            else if (activityIndicatorText == ". &nbsp; &nbsp;")
            {
                self.activityIndicator.html(". . &nbsp;");
            }
            else // (activityIndicatorText == "&nbsp; &nbsp; &nbsp;")
            {
                self.activityIndicator.html(". &nbsp; &nbsp;");
            }
        }, 250);
    }
    
    self.stopActivityIndicator = function()
    {
        self.activityIndicator.hide();
        
        self.projectSelector.removeAttr("disabled");
        self.refreshButton.removeAttr("disabled");
        self.newRecordTaskSelector.removeAttr("disabled");
        self.updateNewRecordAddButton();
        self.recordRemoveButtons.removeAttr("disabled");
    }
}