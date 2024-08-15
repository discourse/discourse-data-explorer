# frozen_string_literal: true

RSpec.describe DiscourseDataExplorer::Parameter do
  def param(identifier, type, default, nullable)
    described_class.new(identifier, type, default, nullable)
  end

  describe ".cast_to_ruby" do
    it "returns nil for nullable blank string" do
      expect(param("param123", :string, nil, true).cast_to_ruby("")).to eq(nil)
    end

    it "raises error for not-nullable blank string" do
      expect { param("param123", :string, nil, false).cast_to_ruby("") }.to raise_error(
        ::DiscourseDataExplorer::ValidationError,
      )
    end

    describe "post_id type" do
      fab!(:post)

      context "when the value provided is a post share URL" do
        it "returns the found post id" do
          expect(param("post_id", :post_id, nil, false).cast_to_ruby(post.url)).to eq(post.id)
        end

        it "returns the found post id when there is a share user param" do
          expect(
            param("post_id", :post_id, nil, false).cast_to_ruby(
              "#{post.url}?u=#{post.user.username}",
            ),
          ).to eq(post.id)
        end

        it "returns the found post id when no post number is provided" do
          expect(
            param("post_id", :post_id, nil, false).cast_to_ruby("#{post.url(share_url: true)}"),
          ).to eq(post.id)
        end

        it "raises an error if no such post exists" do
          post.destroy
          expect { param("post_id", :post_id, nil, false).cast_to_ruby(post.url) }.to raise_error(
            ::DiscourseDataExplorer::ValidationError,
          )
        end
      end

      context "when the value provided is an integer" do
        it "raises an error if no such post exists" do
          expect { param("post_id", :post_id, nil, false).cast_to_ruby("-999") }.to raise_error(
            ::DiscourseDataExplorer::ValidationError,
          )
        end

        it "returns the post id if the post exists" do
          expect(param("post_id", :post_id, nil, false).cast_to_ruby(post.id.to_s)).to eq(post.id)
        end
      end
    end

    describe "group_id type" do
      fab!(:group)

      context "when the value provided is an integer" do
        it "raises an error if no such group exists" do
          expect { param("group_id", :group_id, nil, false).cast_to_ruby("-999") }.to raise_error(
            ::DiscourseDataExplorer::ValidationError,
          )
        end

        it "returns the group id if the group exists" do
          expect(param("group_id", :group_id, nil, false).cast_to_ruby(group.id.to_s)).to eq(
            group.id,
          )
        end
      end
    end
  end
end
