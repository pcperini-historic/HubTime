function controller()
{
    // Static Variables
    self = this;
    
    // Static Functions
    function parseContent(body, info)
    {
        var content = body.replace(info, "");
        content = $.trim(content);
        return content;
    }
    
    function parseDate(dateField)
    {
        var parts = dateField.text().split("/");
        var part = parts[0]; parts[0] = parts[1]; parts[1] = part;
        
        var currentYear = new Date().getFullYear();
        
        if (parts.length < 3)
        {
            parts.push(currentYear);
        }
        if (parts[2] < 1000)
        {
            parts[2] = (currentYear - (currentYear % 1000)) + parseInt(parts[2]);
        }
        
        var date = new Date(parts[2], parts[1] - 1, parts[0]);
        return date;
    }
    
    // Constants
    var controllerDateFormatRegex = /^[0-9]{1,2}\/[0-9]{1,2}(\/[0-9]{2,4})?$/g;
    var controllerHoursFormatRegex = /^[0-9]+$/g;
    var controllerRecordFormatRegex = /\`([0-9]+)h on ([0-9]{1,2}\/[0-9]{1,2}(\/[0-9]{2,4})?)\`(.*)/g;
    
    var controllerUsernameCookie = "hubtime.username";
    var controllerPasswordCookie = "hubtime.password";
    
    var controllerWelcomeMessage = "Welcome back, ";
    
    // Initializers
    self.init = function ()
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
        
        self.activityIndicator = $("#activity-indicator");
        self.recordsTable = $("#records-table");
        
        self.newRecordDateInput = $("#new-record-date-input");
        self.newRecordTaskSelector = $("#new-record-task-selector");
        self.newRecordHoursInput = $("#new-record-hours-input");
        self.newRecordCommentInput = $("#new-record-comment-input");
        self.newRecordAddButton = $("#new-record-add-button");
        self.recordRemoveButtons = $(".record-remove-button");
    
        // Responders
        self.signInButton.click(self.signInButtonWasPressed);
        self.projectSelector.change(self.projectSelectorSelectionDidChange);
        self.newRecordDateInput.keyup(self.newRecordDateInputTextDidChange);
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
    }
    
    // Updaters
    self.updateUser = function(username, password)
    {
        self.githubConnection = new Github({
            "username": username,
            "password": password,
            "auth": "basic"
        });
        
        self.user = self.githubConnection.getUser();
        self.user.records = [];
        
        self.startActivityIndicator();
        self.user.show(username, function(error, info)
        {
            if (error)
            {
                self.stopActivityIndicator();
            
                self.usernameInput.parent().addClass("error");
                self.passwordInput.parent().addClass("error");
                return;
            }
            
            $.cookie(controllerUsernameCookie, username);
            $.cookie(controllerPasswordCookie, password);
            
            self.user.info = info;
            
            self.usernameInput.parent().removeClass("error");
            self.passwordInput.parent().removeClass("error");
            self.signInOverlay.hide();
            self.signInContainer.hide();
            
            self.userInfoContainer.show();
            
            self.userAvatar.attr("src", self.user.info.avatar_url);
            
            var firstName = self.user.info.name.split(" ")[0];
            self.welcomeMessage.text(controllerWelcomeMessage + firstName);
            
            self.stopActivityIndicator();
        });
        
        self.user.repos(function (error, repos)
        {
            if (error)
            {
                return;
            }
        
            for (var repoIndex in repos)
            {
                var repo = repos[repoIndex];
            
                var projectOption = $("<option/>");
                projectOption.text(repo.name);
                
                self.projectSelector.append(projectOption);
            }
            
            self.updateRecordsTable();
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
    
        self.newRecordDateInput.val("");
        self.newRecordTaskSelector.empty();
        self.newRecordHoursInput.val("");
        self.newRecordCommentInput.val("");
            
        // Add New Data
        var repoName = $("#project-selector option:selected").text();
        self.currentRepo = self.githubConnection.getRepo(self.user.info.login, repoName);
        
        self.currentRepo.milestones(function(error, milestones)
        {
            if (error)
            {
                return;
            }
        
            for (var milestoneIndex in milestones)
            {
                var milestone = milestones[milestoneIndex];
            
                var optionGroup = $("<optgroup/>");
                optionGroup.attr("label", milestone.title);
                optionGroup.attr("number", milestone.number);
                
                self.newRecordTaskSelector.append(optionGroup);
                
                self.currentRepo.issues(milestone.number, function(error, issues)
                {
                    if (error)
                    {
                        return;
                    }
                    
                    for (var issueIndex in issues)
                    {
                        var issue = issues[issueIndex];
                        var optionGroup = $("#new-record-task-selector optgroup[number='" + issue.milestone.number + "']");
                        
                        var option = $("<option/>");
                        option.text(issue.title);
                        option.attr("number", issue.number);
                        
                        optionGroup.append(option);
                        
                        self.currentRepo.issueComments(issue, function(issue, error, comments)
                        {
                            if (error)
                            {
                                self.stopActivityIndicator();
                                return;
                            }
                            
                            var recordsTableBody = self.recordsTable.children("tbody");
                            var recordsForSorting = [];
                            for (var commentIndex in comments)
                            {
                                controllerRecordFormatRegex.compile(controllerRecordFormatRegex);
                                var comment = comments[commentIndex];
                                
                                if (controllerRecordFormatRegex.test(comment.body))
                                {
                                    controllerRecordFormatRegex.compile(controllerRecordFormatRegex);
                                    matches = controllerRecordFormatRegex.exec(comment.body);
                                    
                                    var record = {
                                        "hours": matches[1],
                                        "date": matches[2],
                                        "comment": parseContent(comment.body, matches[0])
                                    };
                                    
                                    var recordTableEntry = $("<tr/>");
                                    recordTableEntry.addClass("record");
                                    recordTableEntry.attr("number", comment.id);
                                    
                                    var recordTableEntryDate = $("<td/>");
                                    recordTableEntryDate.text(record.date);
                                    recordTableEntry.append(recordTableEntryDate);
                                    
                                    var recordTableEntryTask = $("<td/>");
                                    var recordTableEntryTaskLink = $("<a/>");
                                    recordTableEntryTaskLink.text(issue.title);
                                    recordTableEntryTaskLink.attr("href", issue.url);
                                    recordTableEntryTask.append(recordTableEntryTaskLink);
                                    recordTableEntry.append(recordTableEntryTask);
                                    
                                    var recordTableEntryHours = $("<td/>");
                                    recordTableEntryHours.text(record.hours);
                                    recordTableEntry.append(recordTableEntryHours);
                                    
                                    var recordTableEntryComments = $("<td/>");
                                    recordTableEntryComments.text(record.comment);
                                    recordTableEntry.append(recordTableEntryComments);
                                    
                                    var recordTableEntryControl = $("<td/>");
                                    var recordTableEntryControlRemoveButton = $("<button/>");
                                    recordTableEntryControlRemoveButton.addClass("btn");
                                    recordTableEntryControlRemoveButton.addClass("btn-small");
                                    recordTableEntryControlRemoveButton.addClass("btn-danger");
                                    recordTableEntryControlRemoveButton.html("<i class='icon-remove icon-white'></i>");
                                    recordTableEntryControlRemoveButton.click(self.removeRecordButtonWasPressed);
                                    recordTableEntryControl.append(recordTableEntryControlRemoveButton);
                                    recordTableEntry.append(recordTableEntryControl);
                                    
                                    recordsForSorting.push(recordTableEntry);
                                }
                            }
                            
                            // Sort Records
                            recordsForSorting.sort(function(recordA, recordB)
                            {
                                recordA = $(recordA.children()[0]);
                                recordB = $(recordB.children()[0]);
                                
                                var recordADate = parseDate(recordA);
                                var recordBDate = parseDate(recordB);
                                
                                if (recordADate == recordBDate)
                                    return 0;
                                else
                                    return recordADate > recordBDate? -1 : 1;
                            });
                            $.each(recordsForSorting, function(recordIndex, record)
                            {
                                var record = $(record);
                                recordsTableBody.prepend(record);
                            });
                        });
                    }
                    
                    self.stopActivityIndicator();
                    self.newRecordTaskSelector.removeAttr("selected");
                });
            }
        });
    }
    
    self.updateNewRecordAddButton = function()
    {
        var buttonEnabled = true;
        buttonEnabled &= !self.newRecordDateInput.parent().hasClass("error");
        buttonEnabled &= Boolean(self.newRecordDateInput.val());
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
    
    self.newRecordDateInputTextDidChange = function(event)
    {
        controllerDateFormatRegex.compile(controllerDateFormatRegex);
        var newRecordDateString = self.newRecordDateInput.val();

        if (controllerDateFormatRegex.test(newRecordDateString))
        {
            self.newRecordDateInput.parent().removeClass("error");
        }
        else
        {
            self.newRecordDateInput.parent().addClass("error");
        }
        
        self.updateNewRecordAddButton();
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
        var newRecordDate = self.newRecordDateInput.val();
        var newRecordIssueNumber = self.newRecordTaskSelector.find("option:selected").attr("number");
        var newRecordHours = self.newRecordHoursInput.val();
        var newRecordComments = self.newRecordCommentInput.val();
        
        var recordString = "`"+ newRecordHours + "h on " + newRecordDate + "`\n\n" + newRecordComments;
        self.currentRepo.addIssueComment(newRecordIssueNumber, recordString, function (error)
        {
            self.updateRecordsTable();
        });
    }
    
    self.removeRecordButtonWasPressed = function(event)
    {
        var removeRecordButton = $(event.target);
        var recordEntry = removeRecordButton.parent().parent();
        if (!recordEntry.attr("number"))
            recordEntry = recordEntry.parent();
        
        var recordCommentNumber = recordEntry.attr("number");
        
        self.currentRepo.removeIssueComment(recordCommentNumber, function (error)
        {
            self.updateRecordsTable();
        });
    }
    
    // Controllers
    self.startActivityIndicator = function()
    {
        self.activityIndicator.show();
        setInterval(function ()
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
    }
}